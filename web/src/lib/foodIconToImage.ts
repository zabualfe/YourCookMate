import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { FoodIconPreset } from './foodIcons'

const CANVAS_SIZE = 256
const ICON_SIZE = 128
const CORNER_RADIUS = 48

function svgMarkupToPngBlob(svg: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    canvas.width = CANVAS_SIZE
    canvas.height = CANVAS_SIZE
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      reject(new Error('Could not create canvas'))
      return
    }

    const img = new Image()
    img.onload = () => {
      ctx.drawImage(img, 0, 0, CANVAS_SIZE, CANVAS_SIZE)
      URL.revokeObjectURL(img.src)
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob)
          else reject(new Error('Could not create image'))
        },
        'image/png',
        0.92,
      )
    }
    img.onerror = () => reject(new Error('Could not render icon'))
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
    img.src = url
  })
}

/** Render a food icon preset to a PNG file for upload. */
export async function foodIconPresetToFile(preset: FoodIconPreset): Promise<File> {
  const iconMarkup = renderToStaticMarkup(
    createElement(preset.Icon, {
      size: ICON_SIZE,
      color: preset.foreground,
      strokeWidth: 1.75,
      absoluteStrokeWidth: true,
    }),
  )

  const inner = iconMarkup
    .replace(/^<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')

  const offset = (CANVAS_SIZE - ICON_SIZE) / 2
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_SIZE}" height="${CANVAS_SIZE}" viewBox="0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}">
  <rect width="${CANVAS_SIZE}" height="${CANVAS_SIZE}" rx="${CORNER_RADIUS}" fill="${preset.background}"/>
  <svg x="${offset}" y="${offset}" width="${ICON_SIZE}" height="${ICON_SIZE}" viewBox="0 0 24 24" fill="none" stroke="${preset.foreground}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
    ${inner}
  </svg>
</svg>`

  const blob = await svgMarkupToPngBlob(svg)
  return new File([blob], `recipe-icon-${preset.id}.png`, { type: 'image/png' })
}

/** Render a food icon preset to a data URL for local storage. */
export async function foodIconPresetToDataUrl(preset: FoodIconPreset): Promise<string> {
  const file = await foodIconPresetToFile(preset)
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Could not read icon'))
    reader.readAsDataURL(file)
  })
}
