import jsPDF from 'jspdf'
import qrcode from 'qrcode-generator'
import type { Tier } from './loyaltyEngine'

export interface CardBack {
  code: string
  tier: Tier
  number: number
}

const CARD_W = 85.6
const CARD_H = 54
const QR_SIZE = 30
const MARGIN = 6

export function qrModules(text: string): boolean[][] {
  const qr = qrcode(0, 'M')
  qr.addData(text)
  qr.make()
  const n = qr.getModuleCount()
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)))
}

export function cardBackPdf(cards: CardBack[]): jsPDF {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [CARD_W, CARD_H] })
  cards.forEach((card, i) => {
    if (i > 0) doc.addPage([CARD_W, CARD_H], 'landscape')
    const modules = qrModules(card.code)
    const cell = QR_SIZE / modules.length
    const top = (CARD_H - QR_SIZE) / 2
    doc.setFillColor(0, 0, 0)
    modules.forEach((row, r) => row.forEach((dark, c) => {
      if (dark) doc.rect(MARGIN + c * cell, top + r * cell, cell, cell, 'F')
    }))
    const textX = MARGIN + QR_SIZE + 6
    doc.setTextColor(0, 0, 0)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text(`Walley's ${card.tier}`, textX, top + 6)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text(`No. ${String(card.number).padStart(3, '0')}`, textX, top + 11)
    doc.setFont('courier', 'bold')
    doc.setFontSize(9)
    doc.text(card.code, textX, top + QR_SIZE - 2)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6)
    doc.text('Scan at checkout', textX, top + QR_SIZE + 2)
  })
  return doc
}
