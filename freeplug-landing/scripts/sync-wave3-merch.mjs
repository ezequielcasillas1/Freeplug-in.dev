#!/usr/bin/env node
/**
 * Build wave-3 catalog entries, download mockups, merge i18n.
 * Usage: node scripts/sync-wave3-merch.mjs [path/to/created-products.json]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const messagesOnly = process.argv.includes('--messages-only')
const CREATED_PATH =
  process.argv.find((a) => a.endsWith('.json')) ??
  '/home/ubuntu/.cursor/projects/agent-repos-Freeplug-in-dev/uploads/created-products_80d3.json'
const COPY_PATH = path.join(ROOT, 'scripts/wave3-product-copy.json')
const META_PATH = path.join(ROOT, 'scripts/wave3-merch-meta.json')
const CATALOG_PATH = path.join(ROOT, 'src/lib/merch/collections/collections-catalog.json')
const EN_PATH = path.join(ROOT, 'messages/en.json')
const ES_PATH = path.join(ROOT, 'messages/es.json')
const PUBLIC_MERCH = path.join(ROOT, 'public/merch')

const COLLECTION_BY_KEY = {
  'recharge-pint': 'drinkware',
  'cool-can-cooler': 'drinkware',
  'unplugged-wine': 'drinkware',
  'offgrid-camping-mug': 'drinkware',
  'stay-charged-pullover': 'apparel',
  'day-one-zip': 'apparel',
  'good-measure-longsleeve': 'apparel',
  'hustle-joggers': 'apparel',
  'ugly-sweater-crew': 'apparel',
  'charged-socks': 'apparel',
  'newest-onesie': 'kids-baby',
  'mini-plug-tee': 'kids-baby',
  'charging-kids-hoodie': 'kids-baby',
  'carry-tote': 'bags-accessories',
  'gym-drawstring': 'bags-accessories',
  'charger-backpack': 'bags-accessories',
  'pocket-fanny': 'bags-accessories',
  'fp-gaiter': 'bags-accessories',
  'website-laptop-sleeve': 'bags-accessories',
  'pin-fp-mark': 'bags-accessories',
  'pin-plug': 'bags-accessories',
  'pin-bolt': 'bags-accessories',
  'good-boy-bandana': 'pets',
  'fuel-bowl': 'pets',
  'recharge-pet-bed': 'pets',
  'human-knows-dog-tee': 'pets',
  'recharge-blanket': 'home-living',
  'plug-clock': 'home-living',
  'rinse-curtain': 'home-living',
  'plugged-cutting-board': 'home-living',
  'coaster-fp': 'home-living',
  'coaster-plug': 'home-living',
  'coaster-bolt': 'home-living',
  'coaster-charged': 'home-living',
  'plug-parking-sign': 'home-living',
  'kjv-bookmark-1': 'home-faith',
  'kjv-bookmark-2': 'home-faith',
  'kjv-bookmark-3': 'home-faith',
  'kjv-bookmark-4': 'home-faith',
  'thanksgiving-tea-towel': 'home-faith',
  'kjv-woven-blanket': 'home-faith',
  'kjv-serving-tray': 'home-faith',
  'pressed-down-framed': 'home-faith',
  'running-over-stocking': 'home-faith',
  'plugged-ornament': 'home-faith',
  'click-mousepad': 'desk-extras',
  'ideas-notebook': 'desk-extras',
  'dont-hit-1-case': 'desk-extras',
  'slim-fp-case': 'desk-extras',
  'poster-1-plug-map': 'wall-art',
  'poster-2-hustle-hours': 'wall-art',
  'poster-3-free-is-a-feeling': 'wall-art',
  'poster-4-wired-different': 'wall-art',
  'stay-connected-framed': 'wall-art',
  'solar-towel': 'outdoor',
  'unplug-picnic': 'outdoor',
  'plug-lives-flag': 'outdoor',
}

const SHIPPING_BY_KEY = {
  'pin-fp-mark': 'sticker',
  'pin-plug': 'sticker',
  'pin-bolt': 'sticker',
  'click-mousepad': 'desk_mat',
  'ideas-notebook': 'journal',
  'plugged-ornament': 'hat',
  'coaster-fp': 'home_standard',
  'coaster-plug': 'home_standard',
  'coaster-bolt': 'home_standard',
  'coaster-charged': 'home_standard',
  'recharge-pint': 'drinkware_heavy',
  'cool-can-cooler': 'drinkware_heavy',
  'unplugged-wine': 'drinkware_heavy',
  'good-boy-bandana': 'home_standard',
  'fuel-bowl': 'canvas_lg',
  'plug-parking-sign': 'canvas_lg',
  'offgrid-camping-mug': 'drinkware_heavy',
  'plug-lives-flag': 'home_standard',
  'kjv-bookmark-1': 'hat',
  'kjv-bookmark-2': 'hat',
  'kjv-bookmark-3': 'hat',
  'kjv-bookmark-4': 'hat',
  'thanksgiving-tea-towel': 'home_standard',
  'charged-socks': 'apparel_light',
  'fp-gaiter': 'hat',
  'carry-tote': 'home_standard',
  'gym-drawstring': 'home_standard',
  'charger-backpack': 'desk_mat',
  'pocket-fanny': 'home_standard',
  'recharge-blanket': 'home_standard',
  'plug-clock': 'desk_mat',
  'plugged-cutting-board': 'canvas_lg',
  'human-knows-dog-tee': 'hat',
  'newest-onesie': 'apparel_light',
  'mini-plug-tee': 'apparel_light',
  'stay-charged-pullover': 'crewneck',
  'day-one-zip': 'crewneck',
  'good-measure-longsleeve': 'apparel_light',
  'hustle-joggers': 'crewneck',
  'charging-kids-hoodie': 'crewneck',
  'ugly-sweater-crew': 'crewneck',
  'dont-hit-1-case': 'home_standard',
  'slim-fp-case': 'home_standard',
  'website-laptop-sleeve': 'home_standard',
  'poster-1-plug-map': 'canvas_sm',
  'poster-2-hustle-hours': 'canvas_sm',
  'poster-3-free-is-a-feeling': 'canvas_sm',
  'poster-4-wired-different': 'canvas_sm',
  'stay-connected-framed': 'canvas_lg',
  'pressed-down-framed': 'canvas_lg',
  'rinse-curtain': 'desk_mat',
  'recharge-pet-bed': 'pet_bed',
  'solar-towel': 'candle_keychain',
  'unplug-picnic': 'desk_mat',
  'running-over-stocking': 'desk_mat',
  'kjv-woven-blanket': 'desk_mat',
  'kjv-serving-tray': 'serving_tray',
}

function titleKey(key) {
  return key.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase())
}

function optionKeyFromTitle(title, id, used) {
  let base = title
    .toLowerCase()
    .replace(/[""″']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  if (!base) base = `variant-${id}`
  let key = base
  let n = 2
  while (used.has(key)) {
    key = `${base}-${n++}`
  }
  used.add(key)
  return key
}

function pickMockupUrl(images) {
  if (!images?.length) return null
  const front = images.find((i) => i.src.includes('camera_label=front'))
  return (front ?? images[0]).src
}

async function downloadMockup(url, dest) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`fetch ${url}: ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  await sharp(buf)
    .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 84, mozjpeg: true })
    .toFile(dest)
}

const created = JSON.parse(fs.readFileSync(CREATED_PATH, 'utf8'))
const copy = JSON.parse(fs.readFileSync(COPY_PATH, 'utf8'))
const meta = JSON.parse(fs.readFileSync(META_PATH, 'utf8'))
const existing = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'))
const wave3Slugs = new Set(created.map((p) => p.key))

const wave3 = messagesOnly
  ? existing.filter((e) => wave3Slugs.has(e.slug))
  : []

if (!messagesOnly) for (const p of created) {
  const collection = COLLECTION_BY_KEY[p.key]
  if (!collection) {
    console.warn('skip unknown collection for', p.key)
    continue
  }
  const shipping_class = SHIPPING_BY_KEY[p.key]
  if (!shipping_class) throw new Error(`missing shipping for ${p.key}`)

  const slug = p.key
  const mockupFile = `${slug}.jpg`
  const destDir = path.join(PUBLIC_MERCH, collection)
  fs.mkdirSync(destDir, { recursive: true })
  const dest = path.join(destDir, mockupFile)
  const url = pickMockupUrl(p.images)
  if (!url) throw new Error(`no mockup for ${p.key}`)
  console.log('image', p.key)
  await downloadMockup(url, dest)

  const used = new Set()
  const options = p.enabled_variants.map((v) => {
    const key = optionKeyFromTitle(v.title, v.id, used)
    const row = {
      key,
      label: v.title,
      printify_variant_id: v.id,
      price_cents: v.price,
    }
    if (shipping_class === 'canvas_lg' || shipping_class === 'canvas_sm') {
      // per-variant size classes for posters/framed
      if (v.title.includes('24') || v.title.includes('60') || v.title.includes('17') || v.title.includes('20″')) {
        row.shipping_class = 'canvas_lg'
      }
    }
    if (p.key === 'recharge-blanket' && v.title.includes('50')) {
      row.shipping_class = 'desk_mat'
    }
    if (p.key === 'kjv-woven-blanket' && v.price > 6000) {
      row.shipping_class = 'desk_mat'
    }
    if (p.key === 'plug-lives-flag' && v.price > 3000) {
      row.shipping_class = 'home_standard'
    }
    if (p.key === 'good-boy-bandana' && v.price > 2700) {
      row.shipping_class = 'home_standard'
    }
    if (p.key === 'solar-towel' && v.price > 5000) {
      row.shipping_class = 'desk_mat'
    }
    if (p.key === 'stay-connected-framed' || p.key === 'pressed-down-framed') {
      row.shipping_class = v.price > 9000 ? 'canvas_lg' : 'canvas_sm'
    }
    if (p.key === 'plugged-cutting-board' && v.title.includes('11')) {
      row.shipping_class = 'home_standard'
    }
    return row
  })

  const c = copy[p.key] ?? {}
  wave3.push({
    slug,
    collection,
    title: p.title,
    title_key: titleKey(slug),
    printify_product_id: p.id,
    shipping_class,
    mockup: mockupFile,
    options: options.length ? options : [],
  })
}

if (!messagesOnly) {
  if (wave3.length !== 57) throw new Error(`expected 57 wave3, got ${wave3.length}`)
  const base = existing.filter((e) => !wave3Slugs.has(e.slug))
  const merged = [...base, ...wave3]
  fs.writeFileSync(CATALOG_PATH, JSON.stringify(merged, null, 2) + '\n')
  console.log('catalog', merged.length, 'products')
} else if (wave3.length !== 57) {
  throw new Error(`expected 57 wave3 in catalog, got ${wave3.length}`)
}

function mergeMessages(filePath, locale) {
  const messages = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  const block = messages.public.merch.collections

  block.collectionTitles['kids-baby'] = locale === 'en' ? meta.collections['kids-baby'].titleEn : meta.collections['kids-baby'].titleEs
  block.collectionTitles['bags-accessories'] =
    locale === 'en' ? meta.collections['bags-accessories'].titleEn : meta.collections['bags-accessories'].titleEs
  block.collectionTitles['pets'] = locale === 'en' ? meta.collections.pets.titleEn : meta.collections.pets.titleEs
  block.collectionTitles['home-living'] =
    locale === 'en' ? meta.collections['home-living'].titleEn : meta.collections['home-living'].titleEs
  block.collectionTitles['wall-art'] = locale === 'en' ? meta.collections['wall-art'].titleEn : meta.collections['wall-art'].titleEs
  block.collectionTitles['outdoor'] = locale === 'en' ? meta.collections.outdoor.titleEn : meta.collections.outdoor.titleEs

  block.collectionLeads['kids-baby'] =
    locale === 'en' ? meta.collections['kids-baby'].leadEn : meta.collections['kids-baby'].leadEs
  block.collectionLeads['bags-accessories'] =
    locale === 'en' ? meta.collections['bags-accessories'].leadEn : meta.collections['bags-accessories'].leadEs
  block.collectionLeads.pets = locale === 'en' ? meta.collections.pets.leadEn : meta.collections.pets.leadEs
  block.collectionLeads['home-living'] =
    locale === 'en' ? meta.collections['home-living'].leadEn : meta.collections['home-living'].leadEs
  block.collectionLeads['wall-art'] = locale === 'en' ? meta.collections['wall-art'].leadEn : meta.collections['wall-art'].leadEs
  block.collectionLeads.outdoor = locale === 'en' ? meta.collections.outdoor.leadEn : meta.collections.outdoor.leadEs

  if (locale === 'en') {
    block.collectionTitles['desk-extras'] = meta.deskExtrasTitleEn
    block.collectionLeads['desk-extras'] = meta.deskExtrasLeadEn
  } else {
    block.collectionTitles['desk-extras'] = meta.deskExtrasTitleEs
    block.collectionLeads['desk-extras'] = meta.deskExtrasLeadEs
  }

  block.collectionLeads['home-faith'] =
    locale === 'en'
      ? 'Home goods featuring the King James scripture: Give, and it shall be given unto you.'
      : 'Artículos para el hogar con la Escritura Reina-Valera 1960: Dad, y se os dará.'
  block.collectionLeads.apparel =
    locale === 'en'
      ? 'Hoodies, joggers, long sleeves, socks, and seasonal crewnecks with Freeplug art.'
      : 'Sudaderas, joggers, manga larga, calcetines y crewnecks de temporada con arte Freeplug.'
  block.collectionLeads.drinkware =
    locale === 'en'
      ? 'Mugs, tumblers, pint glasses, and camp mugs with Freeplug artwork.'
      : 'Tazas, vasos, pintas y tazas de camping con arte Freeplug.'

  for (const row of wave3) {
    const c = copy[row.slug] ?? {}
    const tk = row.title_key
    const titleEn = c.titleEn ?? row.title.replace(/^Freeplug /, '')
    const titleEs = c.titleEs ?? c.titleEn ?? titleEn
    const detailEn = c.detailEn ?? `${titleEn}. Printed to order in the USA.`
    const detailEs = c.detailEs ?? `${titleEs}. Impreso bajo pedido en EE. UU.`
    block.products[tk] = locale === 'en' ? titleEn : titleEs
    block.productDetails[tk] = locale === 'en' ? detailEn : detailEs
    for (const opt of row.options) {
      block.options[opt.key] = opt.label
    }
  }

  block.meta['kids-babyTitle'] = locale === 'en' ? meta.collections['kids-baby'].metaTitleEn : meta.collections['kids-baby'].metaTitleEs
  block.meta['kids-babyDescription'] =
    locale === 'en' ? meta.collections['kids-baby'].metaDescEn : meta.collections['kids-baby'].metaDescEs
  block.meta['bags-accessoriesTitle'] =
    locale === 'en' ? meta.collections['bags-accessories'].metaTitleEn : meta.collections['bags-accessories'].metaTitleEs
  block.meta['bags-accessoriesDescription'] =
    locale === 'en' ? meta.collections['bags-accessories'].metaDescEn : meta.collections['bags-accessories'].metaDescEs
  block.meta['petsTitle'] = locale === 'en' ? meta.collections.pets.metaTitleEn : meta.collections.pets.metaTitleEs
  block.meta.petsDescription = locale === 'en' ? meta.collections.pets.metaDescEn : meta.collections.pets.metaDescEs
  block.meta['home-livingTitle'] =
    locale === 'en' ? meta.collections['home-living'].metaTitleEn : meta.collections['home-living'].metaTitleEs
  block.meta['home-livingDescription'] =
    locale === 'en' ? meta.collections['home-living'].metaDescEn : meta.collections['home-living'].metaDescEs
  block.meta['wall-artTitle'] = locale === 'en' ? meta.collections['wall-art'].metaTitleEn : meta.collections['wall-art'].metaTitleEs
  block.meta['wall-artDescription'] =
    locale === 'en' ? meta.collections['wall-art'].metaDescEn : meta.collections['wall-art'].metaDescEs
  block.meta.outdoorTitle = locale === 'en' ? meta.collections.outdoor.metaTitleEn : meta.collections.outdoor.metaTitleEs
  block.meta.outdoorDescription = locale === 'en' ? meta.collections.outdoor.metaDescEn : meta.collections.outdoor.metaDescEs

  block.meta['desk-extrasTitle'] = locale === 'en' ? meta.deskExtrasMetaTitleEn : meta.deskExtrasMetaTitleEs
  block.meta['desk-extrasDescription'] = locale === 'en' ? meta.deskExtrasMetaDescEn : meta.deskExtrasMetaDescEs

  fs.writeFileSync(filePath, JSON.stringify(messages, null, 2) + '\n')
}

mergeMessages(EN_PATH, 'en')
mergeMessages(ES_PATH, 'es')
console.log('messages updated')
