// Exports the SF Symbols the neoQuad app uses as SVG path data, so the site draws the app's own
// icons instead of lookalikes. Needs a Mac with SF Pro installed (developer.apple.com/fonts):
//
//   swift tools/sf-symbols.swift > src/icons/symbols.ts
//
// SF Pro carries every symbol as a glyph, but not under its name. So each named symbol is drawn by
// AppKit, and the glyph in SF Pro Text Semibold that draws the same shape is found by comparing the
// two pictures. The glyph's outline is what gets written: points at 24 pt, y down, its own box.
// The match score of each symbol is printed to stderr (1 is identical); anything under 0.9 is wrong.
//
// SF Symbols are licensed by Apple; check that licence before adding symbols for new uses.

import AppKit
import CoreText

// The symbol names, exactly as the app's Swift source names them.
let names = [
  "chevron.right",       // row disclosure (EventCardView, SearchTabView)
  "fork.knife",          // EventCategory.food
  "graduationcap.fill",  // EventCategory.academic
  "paintpalette.fill",   // EventCategory.artsCulture
  "person.3.fill",       // EventCategory.clubMeeting
  "figure.walk",         // Directions (EventLiveActivityWidget, PlaceDetailView)
]
let fontPath = "/Library/Fonts/SF-Pro-Text-Semibold.otf"
let size: CGFloat = 24
let grid = 40

// A shape's coverage, fitted into a grid x grid square by its own bounds.
func bitmap(width: Int, height: Int, draw: (CGContext) -> Void) -> [UInt8] {
  let ctx = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width,
                      space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGImageAlphaInfo.none.rawValue)!
  ctx.setFillColor(gray: 0, alpha: 1)
  ctx.fill(CGRect(x: 0, y: 0, width: width, height: height))
  draw(ctx)
  let data = ctx.data!.assumingMemoryBound(to: UInt8.self)
  return Array(UnsafeBufferPointer(start: data, count: width * height))
}

func normalise(_ pixels: [UInt8], _ w: Int, _ h: Int) -> [Float]? {
  var minX = w, minY = h, maxX = -1, maxY = -1
  for y in 0..<h { for x in 0..<w where pixels[y * w + x] > 96 {
    minX = min(minX, x); maxX = max(maxX, x); minY = min(minY, y); maxY = max(maxY, y)
  } }
  guard maxX >= 0 else { return nil }
  let bw = maxX - minX + 1, bh = maxY - minY + 1, side = max(bw, bh)
  var out = [Float](repeating: 0, count: grid * grid)
  let ox = (side - bw) / 2, oy = (side - bh) / 2
  for gy in 0..<grid { for gx in 0..<grid {
    let sx = Int(Float(gx) / Float(grid) * Float(side)) - ox + minX
    let sy = Int(Float(gy) / Float(grid) * Float(side)) - oy + minY
    if sx >= minX && sx <= maxX && sy >= minY && sy <= maxY { out[gy * grid + gx] = Float(pixels[sy * w + sx]) / 255 }
  } }
  return out
}

func similarity(_ a: [Float], _ b: [Float]) -> Float {
  var inter: Float = 0, union: Float = 0
  for i in 0..<a.count { inter += min(a[i], b[i]); union += max(a[i], b[i]) }
  return union == 0 ? 0 : inter / union
}

// Every symbol glyph in SF Pro, as a picture.
let descriptor = (CTFontManagerCreateFontDescriptorsFromURL(URL(fileURLWithPath: fontPath) as CFURL) as! [CTFontDescriptor])[0]
let probe = CTFontCreateWithFontDescriptor(descriptor, 96, nil)
let font = CTFontCreateWithFontDescriptor(descriptor, size, nil)
var candidates: [(glyph: CGGlyph, picture: [Float])] = []
for cp in UInt32(0x100000)...UInt32(0x10FFFD) {
  var units = Array(String(UnicodeScalar(cp)!).utf16)
  var glyphs = [CGGlyph](repeating: 0, count: units.count)
  guard CTFontGetGlyphsForCharacters(probe, &units, &glyphs, units.count), let path = CTFontCreatePathForGlyph(probe, glyphs[0], nil) else { continue }
  let box = path.boundingBoxOfPath
  let pixels = bitmap(width: 160, height: 160) { ctx in
    ctx.translateBy(x: 80 - box.midX, y: 80 - box.midY)
    ctx.addPath(path); ctx.setFillColor(gray: 1, alpha: 1); ctx.fillPath()
  }
  if let picture = normalise(pixels, 160, 160) { candidates.append((glyphs[0], picture)) }
}

func fmt(_ v: CGFloat) -> String {
  var s = String(format: "%.2f", v)
  while s.contains(".") && (s.hasSuffix("0") || s.hasSuffix(".")) { s.removeLast() }
  return s == "-0" ? "0" : s
}

var entries: [String] = []
for name in names {
  let config = NSImage.SymbolConfiguration(pointSize: 96, weight: .semibold)
  guard let image = NSImage(systemSymbolName: name, accessibilityDescription: nil)?.withSymbolConfiguration(config) else {
    FileHandle.standardError.write("missing symbol: \(name)\n".data(using: .utf8)!); exit(1)
  }
  let w = Int(image.size.width.rounded(.up)), h = Int(image.size.height.rounded(.up))
  // AppKit draws the symbol into a colour bitmap; its coverage is the alpha channel.
  let rgba = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4,
                       space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
  NSGraphicsContext.saveGraphicsState()
  NSGraphicsContext.current = NSGraphicsContext(cgContext: rgba, flipped: false)
  image.draw(in: CGRect(x: 0, y: 0, width: w, height: h))
  NSGraphicsContext.restoreGraphicsState()
  let raw = rgba.data!.assumingMemoryBound(to: UInt8.self)
  let pixels = (0..<(w * h)).map { raw[$0 * 4 + 3] }
  let target = normalise(pixels, w, h)!
  let best = candidates.max { similarity($0.picture, target) < similarity($1.picture, target) }!
  let score = similarity(best.picture, target)
  FileHandle.standardError.write("\(name): \(String(format: "%.3f", score))\n".data(using: .utf8)!)

  // The outline, y flipped to point down, in its own tight box.
  let path = CTFontCreatePathForGlyph(font, best.glyph, nil)!
  let box = path.boundingBoxOfPath
  var d = ""
  func p(_ pt: CGPoint) -> String { "\(fmt(pt.x - box.minX)) \(fmt(box.maxY - pt.y))" }
  path.applyWithBlock { element in
    let e = element.pointee
    switch e.type {
    case .moveToPoint: d += "M\(p(e.points[0]))"
    case .addLineToPoint: d += "L\(p(e.points[0]))"
    case .addQuadCurveToPoint: d += "Q\(p(e.points[0])) \(p(e.points[1]))"
    case .addCurveToPoint: d += "C\(p(e.points[0])) \(p(e.points[1])) \(p(e.points[2]))"
    case .closeSubpath: d += "Z"
    @unknown default: break
    }
  }
  entries.append("  '\(name)': { width: \(fmt(box.width)), height: \(fmt(box.height)), d: '\(d)' },")
}

print("""
// Generated by tools/sf-symbols.swift: Apple's SF Symbols, as SF Pro Text Semibold draws them at
// \(Int(size)) pt. Do not edit by hand; add the name there and run it again.

export const symbols = {
\(entries.joined(separator: "\n"))
} as const;

export type SymbolName = keyof typeof symbols;
""")
