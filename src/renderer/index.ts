/**
 * renderer — Mesin render Canvas.
 *
 * Modul murni: TIDAK bergantung pada React maupun lapisan api/. Ia menerima
 * data dan canvas, lalu menggambar. Sifat itu yang membuatnya bisa diuji
 * dengan pengukur teks tiruan tanpa merender komponen apa pun.
 *
 * Jangan mengimpor React atau memanggil backend dari folder ini.
 */

export { JPEG_QUALITY } from './constants';

export { hexToRgb, rgba, mix, type Rgb } from './color';

export {
  wrapText,
  breakLongWord,
  fitText,
  fontStack,
  type TextMeasurer,
  type FitOptions,
  type FitResult,
} from './text';

export {
  makeCanvas,
  get2d,
  loadImage,
  drawImageCover,
  drawLines,
  drawScrim,
} from './canvas';

export { ensureFonts, ensurePreviewFont, previewFamily, resetFonts } from './fonts';

export { createScheduler, type Scheduler } from './scheduler';

export { drawPage, pageCount, pageLabel, type LiveJob } from './live';

export {
  paintBackground,
  proceduralBackground,
  PROCEDURAL_INTENSITY,
  type ProceduralIntensity,
} from './background';

export {
  drawAccentBar,
  drawHandle,
  drawPillBadge,
  drawPageDots,
  drawProgressSegments,
  drawSwipeHint,
} from './elements';

export {
  drawVertical,
  drawCover,
  drawContentSlide,
  drawClosingSlide,
  type VerticalOptions,
  type CoverOptions,
  type ContentSlideOptions,
  type ClosingSlideOptions,
} from './layout';

export {
  renderAll,
  stripDataUrl,
  type RenderJob,
  type RenderedImage,
} from './render';
