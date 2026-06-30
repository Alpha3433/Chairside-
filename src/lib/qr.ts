/**
 * qr.ts — deterministic QR-code SVG generation.
 *
 * Used for the two "arrive by QR / share by QR" moments in the brief:
 *   - the shop's client link on the barber dashboard (print/display it), and
 *   - the shareable spec link on the client's confirmation + public spec page.
 *
 * SVG output (not canvas/PNG) so it renders server-side with no native deps and
 * stays crisp at any print size.
 */

import QRCode from "qrcode";

export async function qrSvg(
  text: string,
  opts: { margin?: number; width?: number } = {},
): Promise<string> {
  return QRCode.toString(text, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: opts.margin ?? 1,
    width: opts.width ?? 220,
    color: { dark: "#111827", light: "#ffffff" },
  });
}
