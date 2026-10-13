import { NICHES, type Niche } from '@/lib/envato/niche-tags'

/**
 * Customer template picker copy. Sable, Oct 12 2026: /workspace/copy/freeplug-template-picker-copy-2026-10-12.md
 * (EN + ES, tú, es-US). This branch has no app i18n files, so (like change-requests/copy.ts) the strings live
 * here keyed by Sable's i18n keys. Spanish renders only when NEXT_PUBLIC_FREEPLUG_I18N_ES === 'true' and the
 * page gets ?lang=es (local review), otherwise English.
 *
 * Card/back/retry/continue/unavailable/cleared/showmore keys: Sable, 'Added 11:30 PM' in the same file.
 * picker.showmore.aria.rest (batch < 12) is not in Sable's file yet. Open: picker.confirm.body "[ask Cheke]".
 */
export type Lang = 'en' | 'es'

const EN = {
  'picker.title': 'Choose your site template',
  'picker.intro': "Pick a look to start from. We'll add your business name, photos and details.",
  'picker.filter.label': 'Business type',
  'picker.count': '{count} templates',
  'picker.count.one': '1 template',
  'picker.card.preview': 'Preview',
  'picker.card.select': 'Choose this one',
  'picker.card.selected': 'Selected',
  'picker.card.alt': 'Preview of the {name} template',
  'picker.confirm.title': 'Use {name} for your site?',
  'picker.confirm.body': 'You can change it until we start building.',
  'picker.confirm.yes': 'Yes, use this template',
  'picker.confirm.back': 'Keep looking',
  'picker.done': "Got it. We'll build your site with {name}.",
  'picker.empty': 'No templates for this business type yet. Change your business type, or let 72 After pick for you.',
  'picker.error': "We couldn't load templates. Please try again.",
  'picker.teampick.title': 'Let 72 After pick for me',
  'picker.teampick.body': "Not sure? We'll choose a template that fits your business.",
  'picker.teampick.done': "Got it. We'll pick a template for you.",
  'picker.paste.title': 'Have a ThemeForest template in mind?',
  'picker.paste.label': 'Template link',
  'picker.paste.placeholder': 'https://themeforest.net/item/...',
  'picker.paste.submit': 'Use this link',
  'picker.paste.error': 'Please paste a link that starts with https://themeforest.net/item/',
  'picker.paste.done': "Got it. We'll review the template you sent.",
  'picker.locked': "Your template is set and we're working on your site. To change it, contact support@freeplug-in.dev.",
  'picker.stale': "This template isn't available anymore. Please choose another.",
  'picker.save.error': "We couldn't save your choice. Please try again.",
  'picker.type.title': 'What kind of business is your site for?',
  'picker.type.body': "We'll show templates that fit it.",
  'picker.type.next': 'Continue',
  'picker.type.change': 'Change business type',
  'picker.type.required': 'Please choose a business type.',
  // Sable, Added 11:30 PM
  'picker.card.title': 'Template',
  'picker.card.choose': 'Choose a template',
  'picker.card.change': 'Change',
  'picker.card.teampick': '72 After will pick',
  'picker.card.unavailable': 'Not available',
  'picker.retry': 'Retry',
  'picker.back': 'Back to your request',
  'picker.continue': 'Continue',
  'picker.type.cleared': 'Your business type changed, so please choose a template again.',
  'picker.showmore': 'Show more',
  'picker.showmore.aria': 'Show 12 more templates',
  // not in Sable's file; string from the 11:30 PM steering message
  'picker.showmore.aria.rest': 'Show more templates',
} as const
export type CopyKey = keyof typeof EN

const ES: Record<CopyKey, string> = {
  'picker.title': 'Elige la plantilla de tu sitio',
  'picker.intro': 'Elige un diseño para empezar. Nosotros agregamos el nombre de tu negocio, tus fotos y tus datos.',
  'picker.filter.label': 'Tipo de negocio',
  'picker.count': '{count} plantillas',
  'picker.count.one': '1 plantilla',
  'picker.card.preview': 'Vista previa',
  'picker.card.select': 'Elegir esta',
  'picker.card.selected': 'Seleccionada',
  'picker.card.alt': 'Vista previa de la plantilla {name}',
  'picker.confirm.title': '¿Usar {name} para tu sitio?',
  'picker.confirm.body': 'Puedes cambiarla hasta que empecemos a construir tu sitio.',
  'picker.confirm.yes': 'Sí, usar esta plantilla',
  'picker.confirm.back': 'Seguir viendo',
  'picker.done': 'Listo. Construiremos tu sitio con {name}.',
  'picker.empty': 'Todavía no hay plantillas para este tipo de negocio. Cambia el tipo de negocio o deja que 72 After elija por ti.',
  'picker.error': 'No pudimos cargar las plantillas. Inténtalo de nuevo.',
  'picker.teampick.title': 'Que 72 After elija por mí',
  'picker.teampick.body': '¿No estás seguro? Elegimos una plantilla que vaya con tu negocio.',
  'picker.teampick.done': 'Listo. Elegiremos una plantilla por ti.',
  'picker.paste.title': '¿Ya tienes una plantilla de ThemeForest en mente?',
  'picker.paste.label': 'Enlace de la plantilla',
  'picker.paste.placeholder': 'https://themeforest.net/item/...',
  'picker.paste.submit': 'Usar este enlace',
  'picker.paste.error': 'Pega un enlace que empiece con https://themeforest.net/item/',
  'picker.paste.done': 'Listo. Revisaremos la plantilla que enviaste.',
  'picker.locked': 'Tu plantilla ya está definida y estamos trabajando en tu sitio. Para cambiarla, escribe a support@freeplug-in.dev.',
  'picker.stale': 'Esta plantilla ya no está disponible. Elige otra.',
  'picker.save.error': 'No pudimos guardar tu elección. Inténtalo de nuevo.',
  'picker.type.title': '¿Para qué tipo de negocio es tu sitio?',
  'picker.type.body': 'Te mostraremos plantillas que le queden bien.',
  'picker.type.next': 'Continuar',
  'picker.type.change': 'Cambiar tipo de negocio',
  'picker.type.required': 'Elige un tipo de negocio.',
  // Sable, Added 11:30 PM
  'picker.card.title': 'Plantilla',
  'picker.card.choose': 'Elige una plantilla',
  'picker.card.change': 'Cambiar',
  'picker.card.teampick': '72 After la elegirá',
  'picker.card.unavailable': 'No disponible',
  'picker.retry': 'Reintentar',
  'picker.back': 'Volver a tu solicitud',
  'picker.continue': 'Continuar',
  'picker.type.cleared': 'Cambiaste el tipo de negocio, así que elige una plantilla otra vez.',
  'picker.showmore': 'Ver más',
  'picker.showmore.aria': 'Ver 12 plantillas más',
  'picker.showmore.aria.rest': 'Ver más plantillas',
}

export const TYPE_LABELS: Record<Lang, Record<Niche, string>> = {
  en: {
    restaurant_texmex: 'Restaurant (Tex-Mex)', food_truck: 'Food truck', medical_clinic: 'Medical clinic', dental: 'Dental office',
    hvac: 'Heating and A/C', plumbing_electrical: 'Plumbing and electrical', roofing_remodel: 'Roofing and remodeling',
    landscaping_lawn: 'Landscaping and lawn care', cleaning: 'Cleaning', auto_repair: 'Auto repair', salon_barber: 'Salon and barbershop',
    fitness: 'Gym and fitness', legal: 'Law office', real_estate: 'Real estate', insurance_tax: 'Insurance and taxes', church: 'Church',
    child_care: 'Child care', pet_care: 'Pet care', event_venue: 'Event venue', other_local: 'Other local business',
  },
  es: {
    restaurant_texmex: 'Restaurante (Tex-Mex)', food_truck: 'Food truck (camión de comida)', medical_clinic: 'Clínica médica',
    dental: 'Consultorio dental', hvac: 'Calefacción y aire acondicionado', plumbing_electrical: 'Plomería y electricidad',
    roofing_remodel: 'Techos y remodelación', landscaping_lawn: 'Jardinería y cuidado del césped', cleaning: 'Limpieza',
    auto_repair: 'Taller mecánico', salon_barber: 'Salón de belleza y barbería', fitness: 'Gimnasio y fitness', legal: 'Despacho de abogados',
    real_estate: 'Bienes raíces', insurance_tax: 'Seguros e impuestos', church: 'Iglesia', child_care: 'Cuidado infantil',
    pet_care: 'Cuidado de mascotas', event_venue: 'Salón de eventos', other_local: 'Otro negocio local',
  },
}

export const COPY: Record<Lang, Record<CopyKey, string>> = { en: EN, es: ES }

export function pickLang(param: string | string[] | undefined): Lang {
  const v = Array.isArray(param) ? param[0] : param
  return v === 'es' && process.env.NEXT_PUBLIC_FREEPLUG_I18N_ES === 'true' ? 'es' : 'en'
}

export function t(lang: Lang, key: CopyKey, vars: Record<string, string | number> = {}): string {
  return COPY[lang][key].replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m))
}

/** Lina: Cleaning first, the rest alphabetical by label in the current language, other_local last. */
export function orderedTypes(lang: Lang): Niche[] {
  const coll = new Intl.Collator(lang === 'es' ? 'es-US' : 'en-US')
  const mid = NICHES.filter((n) => n !== 'cleaning' && n !== 'other_local')
    .slice()
    .sort((a, b) => coll.compare(TYPE_LABELS[lang][a], TYPE_LABELS[lang][b]))
  return ['cleaning', ...mid, 'other_local']
}
