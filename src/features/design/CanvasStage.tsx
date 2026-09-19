/**
 * CanvasStage.tsx — Kanvas interaktif: seret, ubah ukuran, putar.
 *
 * Memakai react-konva (MIT). Yang dibeli dari pustaka itu tepat bagian yang
 * paling mahal ditulis sendiri: uji-tumbukan pada elemen yang diputar,
 * pegangan transform, dan koordinat pointer yang benar di segala tingkat zoom.
 *
 * Kanvas selalu berukuran penuh (1080px) secara logis; yang berubah hanya
 * `scale` untuk menampilkannya di layar. Semua koordinat elemen karena itu
 * tetap dalam piksel kanvas — tidak ada konversi yang berceceran di mana-mana,
 * dan ekspor tidak perlu menebak-nebak ukuran sebenarnya.
 */
import { useEffect, useRef } from 'react';
import { Stage, Layer, Rect, Ellipse, Line, Text, Image as KImage, Transformer } from 'react-konva';
import type Konva from 'konva';
import { CANVAS_PRESETS, type CanvasDoc, type CanvasElement } from '@/types/canvas';
import { useImages } from './useImages';

interface Props {
  doc: CanvasDoc;
  selectedIds: string[];
  scale: number;
  onSelect: (ids: string[]) => void;
  onPatch: (id: string, changes: Partial<CanvasElement>, commit?: boolean) => void;
  onCommit: () => void;
  stageRef: React.MutableRefObject<Konva.Stage | null>;
}

export function CanvasStage({
  doc,
  selectedIds,
  scale,
  onSelect,
  onPatch,
  onCommit,
  stageRef,
}: Props) {
  const size = CANVAS_PRESETS[doc.preset];
  const trRef = useRef<Konva.Transformer>(null);
  const layerRef = useRef<Konva.Layer>(null);
  const images = useImages(doc.elements);

  /*
    Transformer dipasang ke node terpilih setiap kali seleksi berubah.

    Konva tidak menghubungkan keduanya sendiri: ia bekerja pada node, sedangkan
    React bekerja pada id. Jembatan itu harus dibuat manual setelah render,
    ketika node-nya benar-benar sudah ada di layer.
  */
  useEffect(() => {
    const tr = trRef.current;
    const layer = layerRef.current;
    if (!tr || !layer) return;

    const nodes = selectedIds
      .map((id) => layer.findOne<Konva.Node>(`#${id}`))
      .filter((n): n is Konva.Node => Boolean(n));

    tr.nodes(nodes);
    tr.getLayer()?.batchDraw();
  }, [selectedIds, doc.elements]);

  /**
   * Terjemahkan hasil transform Konva kembali ke model.
   *
   * Konva menyatakan perubahan ukuran sebagai `scaleX`/`scaleY` pada node, bukan
   * sebagai lebar/tinggi baru. Kalau skala itu dibiarkan menempel, ia ikut
   * mengalikan tebal garis dan ukuran huruf pada transform berikutnya, dan
   * elemen perlahan melar tak terkendali. Jadi skala dibaca, dikalikan ke
   * ukuran, lalu dikembalikan ke 1.
   */
  function commitTransform(node: Konva.Node, el: CanvasElement) {
    const sx = node.scaleX();
    const sy = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);

    const changes: Partial<CanvasElement> = {
      x: Math.round(node.x()),
      y: Math.round(node.y()),
      width: Math.max(8, Math.round(el.width * sx)),
      height: Math.max(8, Math.round(el.height * sy)),
      rotation: Math.round(node.rotation()),
    };

    // Teks ikut membesar bersama kotaknya; kalau tidak, mengubah ukuran kotak
    // hanya menyisakan ruang kosong dan hurufnya tetap sekecil semula.
    if (el.type === 'text') {
      (changes as Partial<CanvasElement> & { fontSize: number }).fontSize = Math.max(
        8,
        Math.round(el.fontSize * ((sx + sy) / 2)),
      );
    }

    onPatch(el.id, changes, false);
    onCommit();
  }

  /** Sifat yang sama untuk setiap jenis elemen. */
  function common(el: CanvasElement) {
    return {
      id: el.id,
      x: el.x,
      y: el.y,
      rotation: el.rotation,
      opacity: el.visible ? el.opacity : 0,
      draggable: !el.locked && el.visible,
      listening: !el.locked && el.visible,
      onMouseDown: () => onSelect([el.id]),
      onTap: () => onSelect([el.id]),
      onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => {
        onPatch(el.id, { x: Math.round(e.target.x()), y: Math.round(e.target.y()) }, false);
      },
      onDragEnd: () => onCommit(),
      onTransformEnd: (e: Konva.KonvaEventObject<Event>) => commitTransform(e.target, el),
    };
  }

  return (
    <Stage
      ref={stageRef}
      width={size.w * scale}
      height={size.h * scale}
      scaleX={scale}
      scaleY={scale}
      // Klik di area kosong membatalkan seleksi — perilaku yang diharapkan
      // orang dari editor mana pun.
      onMouseDown={(e) => {
        if (e.target === e.target.getStage()) onSelect([]);
      }}
      onTouchStart={(e) => {
        if (e.target === e.target.getStage()) onSelect([]);
      }}
      className="dz-stage"
    >
      <Layer ref={layerRef}>
        <Rect x={0} y={0} width={size.w} height={size.h} fill={doc.background} listening={false} />

        {doc.elements.map((el) => {
          if (el.type === 'shape') {
            if (el.shape === 'ellipse') {
              return (
                <Ellipse
                  key={el.id}
                  {...common(el)}
                  // Ellipse berpusat di titik tengah, sedangkan model memakai
                  // kiri-atas seperti elemen lain. Offset menyatukan keduanya.
                  x={el.x + el.width / 2}
                  y={el.y + el.height / 2}
                  offsetX={0}
                  offsetY={0}
                  radiusX={el.width / 2}
                  radiusY={el.height / 2}
                  fill={el.fill}
                  stroke={el.stroke}
                  strokeWidth={el.strokeWidth}
                  onDragMove={(e) => {
                    onPatch(
                      el.id,
                      {
                        x: Math.round(e.target.x() - el.width / 2),
                        y: Math.round(e.target.y() - el.height / 2),
                      },
                      false,
                    );
                  }}
                />
              );
            }
            if (el.shape === 'line') {
              return (
                <Line
                  key={el.id}
                  {...common(el)}
                  points={[0, 0, el.width, 0]}
                  stroke={el.stroke}
                  strokeWidth={el.strokeWidth}
                  lineCap="round"
                  hitStrokeWidth={Math.max(20, el.strokeWidth)}
                />
              );
            }
            return (
              <Rect
                key={el.id}
                {...common(el)}
                width={el.width}
                height={el.height}
                fill={el.fill}
                stroke={el.stroke}
                strokeWidth={el.strokeWidth}
                cornerRadius={el.cornerRadius}
              />
            );
          }

          if (el.type === 'text') {
            return (
              <Text
                key={el.id}
                {...common(el)}
                width={el.width}
                text={el.text}
                fontFamily={el.fontFamily}
                fontSize={el.fontSize}
                fontStyle={String(el.fontWeight)}
                fill={el.fill}
                align={el.align}
                lineHeight={el.lineHeight}
                letterSpacing={el.letterSpacing}
              />
            );
          }

          const img = images[el.src];
          if (!img) return null;
          return (
            <KImage
              key={el.id}
              {...common(el)}
              image={img}
              width={el.width}
              height={el.height}
            />
          );
        })}

        <Transformer
          ref={trRef}
          rotateEnabled
          // Elemen lebih kecil dari ini tidak bisa lagi dipegang pegangannya.
          boundBoxFunc={(oldBox, newBox) =>
            newBox.width < 16 || newBox.height < 16 ? oldBox : newBox
          }
          anchorSize={10 / scale}
          anchorStroke="#C9A961"
          anchorFill="#fff"
          borderStroke="#C9A961"
          borderStrokeWidth={1.5 / scale}
        />
      </Layer>
    </Stage>
  );
}
