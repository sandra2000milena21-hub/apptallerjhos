import bwipjs from "bwip-js";

/** Código de barras Code 128 en SVG (para etiquetas de órdenes y productos). */
export function code128Svg(text: string, opts: { height?: number; scale?: number } = {}): string {
  return bwipjs.toSVG({
    bcid: "code128",
    text,
    height: opts.height ?? 9,
    scale: opts.scale ?? 2,
    includetext: false,
    paddingwidth: 0,
    paddingheight: 0,
  });
}
