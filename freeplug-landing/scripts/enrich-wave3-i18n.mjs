#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const COPY_PATH = path.join(ROOT, 'scripts/wave3-product-copy.json')

const ES_TITLES = {
  'pin-fp-mark': 'Pin FP Mark',
  'pin-plug': 'Pin Plug',
  'pin-bolt': 'Pin Bolt',
  'coaster-fp': 'Set de portavasos FP Mark',
  'coaster-plug': 'Set de portavasos Plug',
  'coaster-bolt': 'Set de portavasos Bolt',
  'coaster-charged': 'Set de portavasos Fully Charged',
  'recharge-pint': 'Vaso pinta Recharge Station',
  'cool-can-cooler': 'Porta lata Keep It Cool',
  'unplugged-wine': 'Tumbler de vino Unplugged Hours',
  'offgrid-camping-mug': 'Taza de camping Off-Grid Plug',
  'stay-charged-pullover': 'Sudadera con capucha Stay Charged',
  'day-one-zip': 'Sudadera con cremallera Plugged In Since Day One',
  'good-measure-longsleeve': 'Camiseta manga larga Good Measure (Lucas 6:38)',
  'hustle-joggers': 'Joggers Low Battery, High Hustle',
  'ugly-sweater-crew': 'Crewneck ugly sweater plugs & bolts',
  'charged-socks': 'Calcetines Fully Charged Feet',
  'fp-gaiter': 'Gaiter FP circle repeat',
  'carry-tote': 'Tote Carry the Connection',
  'gym-drawstring': 'Bolsa de cuerdas Gym Plug',
  'charger-backpack': 'Mochila Charger Not Included',
  'pocket-fanny': 'Riñonera Pocket Plug',
  'recharge-blanket': 'Manta Recharge Mode',
  'plug-clock': 'Reloj de pared Plug Time',
  'rinse-curtain': 'Cortina de baño Rinse, Recharge, Repeat',
  'plugged-cutting-board': 'Tabla de cortar Plugged-In Kitchen',
  'plug-parking-sign': 'Letrero Plug Parking Only',
  'good-boy-bandana': 'Bandana Good Boy Fully Charged',
  'fuel-bowl': 'Bowl Fuel Station',
  'recharge-pet-bed': 'Cama Recharge Zone',
  'human-knows-dog-tee': 'Tank My Human Knows a Plug',
  'newest-onesie': 'Body Newest Plug',
  'mini-plug-tee': 'Camiseta infantil Mini Plug',
  'charging-kids-hoodie': 'Sudadera juvenil Charging Up',
  'dont-hit-1-case': "Funda tough Don't Let Me Hit 1%",
  'slim-fp-case': 'Funda slim Minimal FP circle',
  'website-laptop-sleeve': 'Funda de portátil Website Was Free',
  'click-mousepad': 'Mousepad Click, Connect, Get Paid',
  'ideas-notebook': 'Cuaderno Ideas Worth Plugging',
  'poster-1-plug-map': 'Póster Plug Map',
  'poster-2-hustle-hours': 'Póster Hustle Hours',
  'poster-3-free-is-a-feeling': 'Póster Free Is a Feeling',
  'poster-4-wired-different': 'Póster Wired Different',
  'stay-connected-framed': 'Lámina enmarcada Stay Connected',
  'pressed-down-framed': 'Lámina enmarcada Pressed Down, Shaken Together',
  'plugged-ornament': 'Adorno Plugged-In Christmas',
  'running-over-stocking': 'Calcetín Fill It Running Over',
  'kjv-woven-blanket': 'Manta tejida Lucas 6:38',
  'kjv-serving-tray': 'Bandeja de servir Lucas 6:38',
  'kjv-bookmark-1': 'Marcapáginas Lucas 6:38 (1)',
  'kjv-bookmark-2': 'Marcapáginas Lucas 6:38 (2)',
  'kjv-bookmark-3': 'Marcapáginas Lucas 6:38 (3)',
  'kjv-bookmark-4': 'Marcapáginas Lucas 6:38 (4)',
  'thanksgiving-tea-towel': 'Paño de cocina Give, and it shall be given unto you',
  'solar-towel': 'Toalla Solar Charging',
  'unplug-picnic': 'Manta de picnic Unplug Together',
  'plug-lives-flag': 'Banderín A Plug Lives Here',
}

const DETAIL_EN = {
  'pin-fp-mark': '1.25″ pin button with FP mark. Sold individually.',
  'good-measure-longsleeve': 'Long sleeve tee with Luke 6:38 artwork on the front only (no sleeve print on this blank).',
  'day-one-zip': 'Fleece zip hoodie with left-chest embroidery. Digitizing ships after your first order.',
  'hustle-joggers': 'Unisex joggers with thigh embroidery. Digitizing ships after your first order.',
  'kjv-woven-blanket': 'Woven throw with the KJV phrase: Give, and it shall be given unto you.',
  'kjv-serving-tray': 'Clear acrylic serving tray with full Luke 6:38 verse artwork.',
  'kjv-bookmark-1': 'Single bookmark with a Luke 6:38 clause. One of four designs.',
  'kjv-bookmark-2': 'Single bookmark with a Luke 6:38 clause. One of four designs.',
  'kjv-bookmark-3': 'Single bookmark with a Luke 6:38 clause. One of four designs.',
  'kjv-bookmark-4': 'Single bookmark with a Luke 6:38 clause. One of four designs.',
  'coaster-fp': 'Set of four hardboard coasters with cork backing, FP artwork on each.',
}

const DETAIL_ES = {
  'pin-fp-mark': 'Pin de 1.25″ con marca FP. Se vende por unidad.',
  'good-measure-longsleeve': 'Camiseta manga larga con Lucas 6:38 solo en el frente (este blank no lleva arte en manga).',
  'day-one-zip': 'Sudadera con cremallera y bordado en el pecho izquierdo. La digitalización del bordado sigue al primer pedido.',
  'hustle-joggers': 'Joggers unisex con bordado en el muslo. La digitalización del bordado sigue al primer pedido.',
  'kjv-woven-blanket': 'Manta tejida con la frase RVR 1960: Dad, y se os dará.',
  'kjv-serving-tray': 'Bandeja acrílica transparente con el texto completo de Lucas 6:38.',
  'kjv-bookmark-1': 'Marcapáginas con una cláusula de Lucas 6:38. Uno de cuatro diseños.',
  'kjv-bookmark-2': 'Marcapáginas con una cláusula de Lucas 6:38. Uno de cuatro diseños.',
  'kjv-bookmark-3': 'Marcapáginas con una cláusula de Lucas 6:38. Uno de cuatro diseños.',
  'kjv-bookmark-4': 'Marcapáginas con una cláusula de Lucas 6:38. Uno de cuatro diseños.',
  'coaster-fp': 'Set de cuatro portavasos de cartón con corcho, mismo diseño en cada uno.',
  'thanksgiving-tea-towel': 'Paño de cocina 28″ con la frase bíblica aprobada.',
}

const copy = JSON.parse(fs.readFileSync(COPY_PATH, 'utf8'))
for (const [key, row] of Object.entries(copy)) {
  row.titleEs = ES_TITLES[key] ?? row.titleEn
  row.detailEn = DETAIL_EN[key] ?? `${row.titleEn}. Printed to order in the USA.`
  row.detailEs = DETAIL_ES[key] ?? `${row.titleEs}. Impreso bajo pedido en EE. UU.`
}
fs.writeFileSync(COPY_PATH, JSON.stringify(copy, null, 2) + '\n')

import { spawnSync } from 'node:child_process'
spawnSync('node', [path.join(ROOT, 'scripts/sync-wave3-merch.mjs'), '--messages-only'], { stdio: 'inherit', cwd: ROOT })
