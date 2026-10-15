/**
 * Byte-level JPEG metadata stripping (Cloudflare port, Oct 3). No decoding, so it is cheap and runs
 * the same on Workers, Node and in tests.
 *
 * Why it exists: the Privacy Policy says uploaded photos lose their location and camera data. The
 * Cloudflare Images binding (env.IMAGES) re-encodes the photo, and Cloudflare documents that for
 * JPEG output its default `metadata=copyright` "discards all metadata except EXIF copyright tag"
 * (https://developers.cloudflare.com/images/optimization/features/#metadata). The binding's typed
 * transform/output options have no `metadata` field to ask for `none`, so we don't rely on it:
 * after any codec, every segment below that can carry metadata is removed here, which makes the
 * stored file metadata-free (the same result the old sharp pipeline gave).
 *
 * Kept: SOI/EOI, frame/scan/table segments and image data, APP0 "JFIF" (format header only),
 * APP2 "ICC_PROFILE" (colour only) and APP14 "Adobe" (colour-transform flag needed to decode).
 * Removed: APP1 (EXIF incl. GPS, XMP), APP2 other than ICC (e.g. MPF extra images), APP3-APP13
 * (APP13 = IPTC/Photoshop), APP15, APP0 other than JFIF (JFXX thumbnails), COM comments, and
 * anything after EOI (appended images or data).
 */

export function isJpeg(buf: Uint8Array): boolean {
  return buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff
}

const SOI = 0xd8
const EOI = 0xd9
const SOS = 0xda
const COM = 0xfe

function startsWithAscii(buf: Uint8Array, offset: number, end: number, text: string): boolean {
  if (offset + text.length > end) return false
  for (let i = 0; i < text.length; i++) if (buf[offset + i] !== text.charCodeAt(i)) return false
  return true
}

/** True when a marker segment (given its payload range) is kept. */
function keepSegment(marker: number, buf: Uint8Array, payloadStart: number, payloadEnd: number): boolean {
  if (marker === COM) return false
  if (marker >= 0xe0 && marker <= 0xef) {
    if (marker === 0xe0) return startsWithAscii(buf, payloadStart, payloadEnd, 'JFIF\0')
    if (marker === 0xe2) return startsWithAscii(buf, payloadStart, payloadEnd, 'ICC_PROFILE\0')
    if (marker === 0xee) return startsWithAscii(buf, payloadStart, payloadEnd, 'Adobe')
    return false
  }
  return true
}

export type JpegSegment = { marker: number; name: string; offset: number; length: number }

function markerName(m: number): string {
  if (m >= 0xe0 && m <= 0xef) return `APP${m - 0xe0}`
  if (m === COM) return 'COM'
  if (m === SOS) return 'SOS'
  if (m === EOI) return 'EOI'
  if (m === SOI) return 'SOI'
  return `0x${m.toString(16).toUpperCase()}`
}

/**
 * Walks the JPEG. With `strip`, returns a copy without metadata segments; always returns the list
 * of marker segments that were found (before stripping). Throws on a malformed file.
 */
function walk(buf: Uint8Array, strip: boolean): { out: Uint8Array; segments: JpegSegment[] } {
  if (!isJpeg(buf)) throw new Error('not a JPEG')
  const chunks: Uint8Array[] = [buf.subarray(0, 2)]
  const segments: JpegSegment[] = [{ marker: SOI, name: 'SOI', offset: 0, length: 2 }]
  let i = 2
  for (;;) {
    if (i >= buf.length) throw new Error('JPEG ended before EOI')
    if (buf[i] !== 0xff) throw new Error('expected a JPEG marker')
    // Fill bytes: any number of 0xFF before the marker code.
    let j = i
    while (j < buf.length && buf[j] === 0xff) j++
    if (j >= buf.length) throw new Error('JPEG ended inside a marker')
    const marker = buf[j]
    const markerStart = j - 1
    if (marker === EOI) {
      segments.push({ marker, name: 'EOI', offset: markerStart, length: 2 })
      chunks.push(buf.subarray(markerStart, markerStart + 2))
      break // anything after EOI is dropped
    }
    if (marker === SOI || marker === 0x00 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      // Standalone markers outside a scan are unusual; keep them as-is.
      segments.push({ marker, name: markerName(marker), offset: markerStart, length: 2 })
      chunks.push(buf.subarray(markerStart, markerStart + 2))
      i = j + 1
      continue
    }
    if (j + 2 >= buf.length) throw new Error('JPEG ended inside a segment length')
    const len = (buf[j + 1] << 8) | buf[j + 2]
    if (len < 2) throw new Error('bad JPEG segment length')
    const segEnd = j + 1 + len
    if (segEnd > buf.length) throw new Error('JPEG segment runs past the end')
    segments.push({ marker, name: markerName(marker), offset: markerStart, length: segEnd - markerStart })
    if (!strip || keepSegment(marker, buf, j + 3, segEnd)) chunks.push(buf.subarray(markerStart, segEnd))
    i = segEnd
    if (marker === SOS) {
      // Entropy-coded data runs until a marker that is not a stuffed 0xFF00 or a restart marker.
      let k = i
      while (k < buf.length) {
        if (buf[k] === 0xff && k + 1 < buf.length) {
          const next = buf[k + 1]
          if (next === 0x00 || (next >= 0xd0 && next <= 0xd7) || next === 0xff) {
            k += next === 0xff ? 1 : 2
            continue
          }
          break
        }
        k++
      }
      if (k >= buf.length) throw new Error('JPEG scan ran past the end')
      chunks.push(buf.subarray(i, k))
      i = k
    }
  }
  const total = chunks.reduce((n, c) => n + c.length, 0)
  const out = new Uint8Array(total)
  let o = 0
  for (const c of chunks) {
    out.set(c, o)
    o += c.length
  }
  return { out, segments }
}

/** A copy of the JPEG with every metadata segment removed (see the file comment). Throws if malformed. */
export function stripJpegMetadata(buf: Uint8Array): Uint8Array {
  return walk(buf, true).out
}

/** The marker segments in a JPEG (for tests and checks). Throws if malformed. */
export function jpegSegments(buf: Uint8Array): JpegSegment[] {
  return walk(buf, false).segments
}

/** Marker names of segments that can carry metadata and would be stripped (empty = clean). */
export function jpegMetadataSegmentNames(buf: Uint8Array): string[] {
  return jpegSegments(buf)
    .filter((s) => s.length > 2 && !keepSegment(s.marker, buf, s.offset + 4, s.offset + s.length))
    .map((s) => s.name)
}
