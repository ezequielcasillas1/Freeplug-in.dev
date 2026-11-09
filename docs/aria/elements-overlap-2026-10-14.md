# Elements overlap for the Freeplug template picker (2026-10-14)

Research only. Nothing was bought, nobody was contacted, Arkitect was not run. Prepared 2026-10-14, about 2:45–3:40 AM CT.

**Inputs:** the 125 `confirmed` picks in `/workspace/lina/envato-shortlist-2026-10-12.json` (cleaning has 13). Lina's JSON has no id field, so the **shortlist id is `<type>-<position in that type's JSON array>`** (1-based, cut and unverified picks included in the count). Example: `cleaning-8` = SmartClean.

## Method and caveats
- **Elements check, public pages only.** For each pick I ran (a) an Elements keyword search in the matching category (`elements.envato.com/web-templates/<name>` for HTML, `/wordpress/<name>` for WP) and (b) a crawl of the author's Elements portfolio (`/user/<author>/<category>`, every page). I counted a pick as **yes** only when an Elements item page had the same name and the same author, and for HTML it also had to be the HTML edition. React, PHP, or Elementor-kit editions alone don't count. Two items are listed on Elements under a different title, and their pages name the theme (see notes).
- **no** means the author has a browsable Elements portfolio that I crawled in full, and neither that portfolio nor the title search turned up the item. Some authors use short brand-only slugs on Elements, and I opened only the item pages whose slugs suggested the business type. So a "no" is strong evidence, not absolute proof.
- **unverified** means the author's Elements portfolio URL returned HTTP 500 (a made-up user returns 404, so these authors exist, but they have no browsable Elements page), or the ThemeForest author is unknown, and the title search found nothing. These are **probably ThemeForest-only**, but that isn't confirmed.
- **Prices.** `/workspace/freeplug-ladder/freeplug-landing/scripts/clean-env.sh` **does not exist**, so I did **not** use the Envato API or `ENVATO_API_TOKEN`. Prices come from public ThemeForest item pages, which I fetched today for the 10 cleaning picks Lina had no price for, or from Lina's 2026-10-12 shortlist values (labelled). Prices Lina took from search summaries are marked unverified. "unverified" means no price was found. ThemeForest shows one price, the Regular license for a single end product, and it already includes the buyer fee.

## 1. Per-item table

### Cleaning (house cleaning / maid / housekeeping / janitorial)

| Shortlist id | Title | Type | On Elements | Elements URL / note | ThemeForest Regular price |
|---|---|---|---|---|---|
| cleaning-2 | [Xcleen - Cleaning Services](https://themeforest.net/item/xclean-cleaning-services-wordpress-theme/54481523) | WP | unverified | author has no browsable Elements portfolio (HTTP 500); title search found nothing, likely ThemeForest-only | $59 (TF page 10/14) |
| cleaning-3 | [Cetro - Cleaning Service](https://themeforest.net/item/cetro-cleaning-service-wordpress-theme/58997279) | WP | unverified | author has no browsable Elements portfolio (HTTP 500); title search found nothing, likely ThemeForest-only | $49 (TF page 10/14) |
| cleaning-4 | [Be Clean - Cleaning, Maid & Laundry](https://themeforest.net/item/be-clean-cleaning-company-maid-service-laundry-wordpress-theme/15360714) | WP | no | not in author's Elements wordpress portfolio (84 items crawled) or title search | $59 (TF page 10/14) |
| cleaning-5 | [Cleaning Services WordPress Theme + RTL](https://themeforest.net/item/cleaning-services-wordpress-theme/20283498) | WP | no | not in author's Elements wordpress portfolio (50 items crawled) or title search | $50 (TF page 10/14) |
| cleaning-6 | [Cleanu - Cleaning Services HTML](https://themeforest.net/item/cleanu-cleaning-services-template/36372817) | HTML | yes | [cleanu-cleaning-services-html-template-LK2UYXU](https://elements.envato.com/cleanu-cleaning-services-html-template-LK2UYXU) | $23 (TF page 10/14) |
| cleaning-8 | [SmartClean / Housekeeping & Cleaning Company](https://themeforest.net/item/smartclean-cleaning-company-theme/20493112) | WP | no | not in author's Elements wordpress portfolio (183 items crawled) or title search | $69 (Lina 10/12) |
| cleaning-9 | [CleanMate - Cleaning Company & Maid](https://themeforest.net/item/cleanmate-cleaning-company-maid-gardening-wordpress-theme/20981913) | WP | no | not in author's Elements wordpress portfolio (14 items crawled) or title search | $79 (TF page 10/14) |
| cleaning-10 | [Cleaning Company - Maid Service WP + Online Store](https://themeforest.net/item/cleaning-company-maid-janitorial-service-theme/12433819) | WP | no | not in author's Elements wordpress portfolio (183 items crawled) or title search | $69 (Lina 10/12) |
| cleaning-11 | [Xcleen - Cleaning Services HTML](https://themeforest.net/item/xcleen-cleaning-services-html-template/55106156) | HTML | unverified | author has no browsable Elements portfolio (HTTP 500); title search found nothing, likely ThemeForest-only | $25 (TF page 10/14) |
| cleaning-12 | [Cleanify - Cleaning Services HTML](https://themeforest.net/item/cleanify-cleaning-services-html-template/61099738) | HTML | yes | [cleanify-cleaning-services-html-4PGZNDD](https://elements.envato.com/cleanify-cleaning-services-html-4PGZNDD) | $25 (Lina 10/12) |
| cleaning-13 | [Clenia - Cleaning Services HTML](https://themeforest.net/item/clenia-cleaning-services-html-template/36890638) | HTML | yes | [clenia-cleaning-services-html-template-JXUM4E4](https://elements.envato.com/clenia-cleaning-services-html-template-JXUM4E4) — Elements author Devsdesign = TF author | $8 (TF page 10/14) |
| cleaning-14 | [Tidytouch – Cleaning Services HTML](https://themeforest.net/item/tidytouch-cleaning-services-html-template/58143517) | HTML | yes | [tidytouch-cleaning-services-html-template-8CWJMCS](https://elements.envato.com/tidytouch-cleaning-services-html-template-8CWJMCS) — HTML edition on Elements (PHP/Laravel editions too) | $18 (TF page 10/14) |
| cleaning-15 | [Kean - Cleaning Services HTML5](https://themeforest.net/item/kean-cleaning-services-html5-template/36509820) | HTML | no | TF author ThemeOri (from TF page); ThemeOri Elements web-templates portfolio and title search show no Kean | $12 (TF page 10/14) |

### restaurant_texmex

| Shortlist id | Title | Type | On Elements | Elements URL / note | ThemeForest Regular price |
|---|---|---|---|---|---|
| restaurant_texmex-2 | [Foores - Restaurant Site Template](https://themeforest.net/item/foogra-restaurant-site-template/33945871) | HTML | yes | [foores-restaurant-site-template-PC2RJ4K](https://elements.envato.com/foores-restaurant-site-template-PC2RJ4K) | $29 (Lina 10/12) |
| restaurant_texmex-3 | [Dinevo – Modern Restaurant & Cafe HTML](https://themeforest.net/item/dinevo-modern-restaurant-cafe-html-template/62977120) | HTML | unverified | author has no browsable Elements portfolio (HTTP 500); title search found nothing, likely ThemeForest-only | unverified |
| restaurant_texmex-4 | [Babuka - Restaurant & Fast Food HTML](https://themeforest.net/item/babuka-restaurant-fast-food-html-template/64976945) | HTML | yes | [babuka-restaurant-fast-food-html-template-5VGSVDJ](https://elements.envato.com/babuka-restaurant-fast-food-html-template-5VGSVDJ) | unverified |
| restaurant_texmex-5 | [Restora - Restaurant Cafe & Bistro Template](https://themeforest.net/item/restora-restaurant-cafe-bistro-template/20295075) | HTML | unverified | Elements 'Restoral' (codecarnival) is a different item | unverified |
| restaurant_texmex-6 | [Pasta - Restaurant HTML Responsive Template](https://themeforest.net/item/pasta-restaurant-html-responsive-template/19246695) | HTML | unverified | author has no browsable Elements portfolio (HTTP 500); title search found nothing, likely ThemeForest-only | unverified |
| restaurant_texmex-7 | [Caban - Restaurant & Cafe Bootstrap 5](https://themeforest.net/item/caban-restaurant-cafe-html-template/33649947) | HTML | no | not in author's Elements web-templates portfolio (48 items crawled) or title search | unverified |

### food_truck

| Shortlist id | Title | Type | On Elements | Elements URL / note | ThemeForest Regular price |
|---|---|---|---|---|---|
| food_truck-3 | [Food Truck - Modern Theme for Food truckers](https://themeforest.net/item/food-truck-restaurant-wordpress-theme/19396786) | WP | unverified | author has no browsable Elements portfolio (HTTP 500); title search found nothing, likely ThemeForest-only | $39 (Lina 10/12) |
| food_truck-4 | [Meals & Wheels / Street Festival & Fast Food](https://themeforest.net/item/meals-wheels-street-food-festival-fast-food-delivery-wordpress-theme/22991263) | WP | yes | [meals-wheels-5UDH9EC](https://elements.envato.com/meals-wheels-5UDH9EC) | unverified |
| food_truck-5 | [Foodio - Fast Food Restaurant WordPress Theme](https://themeforest.net/item/foodio-fast-food-restaurant-wordpress-theme/46084922) | WP | yes | [foodio-fast-food-restaurant-wordpress-theme-3VECLGJ](https://elements.envato.com/foodio-fast-food-restaurant-wordpress-theme-3VECLGJ) | $45 (Lina 10/12) |
| food_truck-6 | [Babuka - Restaurant & Fast Food HTML](https://themeforest.net/item/babuka-restaurant-fast-food-html-template/64976945) | HTML | yes | [babuka-restaurant-fast-food-html-template-5VGSVDJ](https://elements.envato.com/babuka-restaurant-fast-food-html-template-5VGSVDJ) | unverified |
| food_truck-7 | [Food Truck - Street Trucks & Restaurant HTML](https://themeforest.net/item/food-truck-food-truck-and-restaurant-responsive-html-template/18339431) | HTML | unverified | author has no browsable Elements portfolio (HTTP 500); title search found nothing, likely ThemeForest-only | unverified |
| food_truck-8 | [Foodu - Fast Food & Restaurant HTML](https://themeforest.net/item/foodu-food-and-restaurant-html-template/54441096) | HTML | yes | [foodu-food-restaurant-html-template-UVUJSWV](https://elements.envato.com/foodu-food-restaurant-html-template-UVUJSWV) | $17 (Lina 10/12) |

### medical_clinic

| Shortlist id | Title | Type | On Elements | Elements URL / note | ThemeForest Regular price |
|---|---|---|---|---|---|
| medical_clinic-1 | [Hospa - Doctors, Medical Clinic & Hospital](https://themeforest.net/item/hospa-medical-clinic-hospital-wordpress-theme/52237458) | WP | no | not in author's Elements wordpress portfolio (48 items crawled) or title search | $35 (Lina 10/12) |
| medical_clinic-2 | [Vigour - Health Clinic Medical](https://themeforest.net/item/vigour-health-clinic-medical-wordpress-theme/64941459) | WP | no | not in author's Elements wordpress portfolio (175 items crawled) or title search | $69 (Lina 10/12) |
| medical_clinic-3 | [Bigmedix - Medical and Health Care](https://themeforest.net/item/bigmedix-medical-and-health-care-wordpress-theme/57590652) | WP | unverified | author has no browsable Elements portfolio (HTTP 500); title search found nothing, likely ThemeForest-only | $49 (Lina 10/12) |
| medical_clinic-5 | [Dr.Patterson / Medical & Healthcare Doctor](https://themeforest.net/item/drpatterson-medicine-healthcare-wordpress-theme/22022431) | WP | no | not in author's Elements wordpress portfolio (199 items crawled) or title search | unverified |
| medical_clinic-6 | [Hospil - Medical Hospital & Healthcare HTML](https://themeforest.net/item/hospil-medical-and-healthcare-template/63954517) | HTML | no | not in author's Elements web-templates portfolio (2 items crawled) or title search | unverified |
| medical_clinic-7 | [Madies - Health & Medical HTML](https://themeforest.net/item/madies-health-medical-html-template/64071820) | HTML | yes | [madies-health-medical-html-template-5V8DF8A](https://elements.envato.com/madies-health-medical-html-template-5V8DF8A) | unverified |
| medical_clinic-8 | [Medin - Medical Clinic HTML Template](https://themeforest.net/item/medin-medical-clinic-html-template/22564438) | HTML | unverified | author has no browsable Elements portfolio (HTTP 500); title search found nothing, likely ThemeForest-only | $19 (Lina 10/12) |
| medical_clinic-9 | [Clinica - Medical HTML Template](https://themeforest.net/item/clinica-multipurpose-medical-html-template/19380068) | HTML | yes | [clinica-medical-html-template-SZ724F6](https://elements.envato.com/clinica-medical-html-template-SZ724F6) | unverified |

### dental

| Shortlist id | Title | Type | On Elements | Elements URL / note | ThemeForest Regular price |
|---|---|---|---|---|---|
| dental-1 | [Healthy Smiles - Dental](https://themeforest.net/item/healthy-smiles-dental-wordpress-theme/33615385) | WP | yes | [healthy-smiles-dental-wordpress-theme-9ND9TW3](https://elements.envato.com/healthy-smiles-dental-wordpress-theme-9ND9TW3) | $69 (Lina 10/12) |
| dental-4 | [DentiCare - Medical & Dentist](https://themeforest.net/item/denticare-medical-wordpress-theme/25957410) | WP | unverified | author has no browsable Elements portfolio (HTTP 500); title search found nothing, likely ThemeForest-only | unverified |
| dental-5 | [Stomatology - Dentist & Dental Clinic](https://themeforest.net/item/stomatology-dentist-dental-clinic-wordpress-theme/59021095) | WP | yes | [stomatology-SFHXZF4](https://elements.envato.com/stomatology-SFHXZF4) | $69 (Lina 10/12) |
| dental-6 | [Denture - Dental Clinic HTML](https://themeforest.net/item/denture-dental-clinic-html-template/59735731) | HTML | unverified | author has no browsable Elements portfolio (HTTP 500); title search found nothing, likely ThemeForest-only | unverified |
| dental-8 | [Dentexa - Dental Clinic HTML](https://themeforest.net/item/dentexa-dental-clinic-html-template/60809286) | HTML | yes | [dentexa-dental-clinic-html-template-876GZ6G](https://elements.envato.com/dentexa-dental-clinic-html-template-876GZ6G) | unverified |
| dental-9 | [Doral - Dentist & Dental Care Bootstrap 5](https://themeforest.net/item/doral-dentist-dental-care-html-template/52268170) | HTML | unverified | author has no browsable Elements portfolio (HTTP 404); title search found nothing, likely ThemeForest-only | unverified |
| dental-10 | [Grin - Medical Health & Dental Clinic](https://themeforest.net/item/grin-dentist-dental-clinic-html-template/30448689) | HTML | no | not in author's Elements web-templates portfolio (48 items crawled) or title search | unverified |

### hvac

| Shortlist id | Title | Type | On Elements | Elements URL / note | ThemeForest Regular price |
|---|---|---|---|---|---|
| hvac-1 | [Coolify - HVAC WordPress Theme](https://themeforest.net/item/coolify-air-conditioning-heating-hvac-wordpress-theme/59094057) | WP | unverified | author has no browsable Elements portfolio (HTTP 500); title search found nothing, likely ThemeForest-only | $59 (Lina 10/12) |
| hvac-2 | [Coolair - Air Conditioning & Heating HVAC](https://themeforest.net/item/coolair-air-conditioning-heating-hvac-wordpress-theme/52575514) | WP | yes | [coolair-air-conditioning-heating-hvac-wordpres-6LLNDT3](https://elements.envato.com/coolair-air-conditioning-heating-hvac-wordpres-6LLNDT3) | $69 regular ($55 on sale) (Lina 10/12) |
| hvac-3 | [Airtech - Plumber HVAC and Repair](https://themeforest.net/item/airtech-plumber-wordpress-theme/24428877) | WP | yes | [airtech-plumber-wordpress-theme-D5GALDW](https://elements.envato.com/airtech-plumber-wordpress-theme-D5GALDW) | $59 (Lina 10/12) |
| hvac-5 | [AirSupply / Conditioning & Heating Services](https://themeforest.net/item/air-conditioning-company-and-heating-services/18609262) | WP | no | not in author's Elements wordpress portfolio (199 items crawled) or title search | $69 (Lina 10/12) |
| hvac-6 | [Airz - Air Conditioning & Heating HVAC](https://themeforest.net/item/airz-air-conditioning-heating-hvac-wordpress-theme/57973896) | WP | no | not in author's Elements wordpress portfolio (10 items crawled) or title search | $75 (Lina 10/12) |
| hvac-7 | [CoolAir - HVAC Service Website Template](https://themeforest.net/item/coolair-air-conditioning-heating-hvac-website-template/51767630) | HTML | yes | [air-conditioning-heating-hvac-website-template-8A9QAY9](https://elements.envato.com/air-conditioning-heating-hvac-website-template-8A9QAY9) — Elements title differs: 'Air Conditioning & Heating HVAC Website Template' (designesia), page names CoolAir | $17 (Lina 10/12) |
| hvac-8 | [Arctiq – Air Conditioning & Heating HTML](https://themeforest.net/item/arctiq-air-conditioning-heating-services-html-template/64842564) | HTML | unverified | author has no browsable Elements portfolio (HTTP 500); title search found nothing, likely ThemeForest-only | $49 (Lina 10/12) |

### plumbing_electrical

| Shortlist id | Title | Type | On Elements | Elements URL / note | ThemeForest Regular price |
|---|---|---|---|---|---|
| plumbing_electrical-2 | [Ploming - Plumber & Handyman WP](https://themeforest.net/item/ploming-plumber-handyman-wordpress-theme/52343981) | WP | yes | [ploming-plumber-handyman-wordpress-theme-628FD8G](https://elements.envato.com/ploming-plumber-handyman-wordpress-theme-628FD8G) | $49 (Lina 10/12) |
| plumbing_electrical-3 | [Ploming - Plumber & Handyman HTML](https://themeforest.net/item/ploming-plumber-handyman-html-template/50396415) | HTML | no | not in author's Elements web-templates portfolio (94 items crawled) or title search | unverified |
| plumbing_electrical-4 | [Plumbor - Plumber Service HTML5](https://themeforest.net/item/plumbor-plumber-service-html5-template/59005380) | HTML | yes | [plumbor-plumber-service-html5-template-TXLMQS4](https://elements.envato.com/plumbor-plumber-service-html5-template-TXLMQS4) | $12 (search summary, unverified) |
| plumbing_electrical-5 | [Electrician - Electricity Services WP](https://themeforest.net/item/electrician-electricity-services-wordpress-theme/19212980) | WP | no | not in author's Elements wordpress portfolio (50 items crawled) or title search | $50 (Lina 10/12) |
| plumbing_electrical-6 | [Electricien - Electrician Electrical WP](https://themeforest.net/item/electricien-electrician-electrical-services-wordpress-theme/56728691) | WP | yes | [electricien-electrician-electrical-wordpress-9BY8C6S](https://elements.envato.com/electricien-electrician-electrical-wordpress-9BY8C6S) | $59 (Lina 10/12) |
| plumbing_electrical-8 | [Caren - Electricity Services WP](https://themeforest.net/item/caren-electricity-services-wordpress-theme/58403553) | WP | unverified | author has no browsable Elements portfolio (HTTP 500); title search found nothing, likely ThemeForest-only | unverified |

### roofing_remodel

| Shortlist id | Title | Type | On Elements | Elements URL / note | ThemeForest Regular price |
|---|---|---|---|---|---|
| roofing_remodel-1 | [Roofix - Roofing Services WP](https://themeforest.net/item/roofix-roofing-services-wordpress-theme/27855848) | WP | no | not in author's Elements wordpress portfolio (9 items crawled) or title search | $59 (Lina 10/12) |
| roofing_remodel-2 | [Roofex - Roofing WP](https://themeforest.net/item/roofex-roofing-services-wordpress-theme/44085706) | WP | yes | [roofex-roofing-wordpress-theme-5X2HEF8](https://elements.envato.com/roofex-roofing-wordpress-theme-5X2HEF8) | $49 (Lina 10/12) |
| roofing_remodel-3 | [Roofio - Roofing Services WP](https://themeforest.net/item/roofio-roofing-services-wordpress-theme/46175031) | WP | no | not in author's Elements wordpress portfolio (4 items crawled) or title search | $39 (Lina 10/12) |
| roofing_remodel-5 | [Aurox - Roofing Services WP](https://themeforest.net/item/aurox-roofing-services-wordpress-theme/62542421) | WP | unverified | author has no browsable Elements portfolio (HTTP 500); title search found nothing, likely ThemeForest-only | $59 (Lina 10/12) |
| roofing_remodel-6 | [Awning - Roofing Services HTML](https://themeforest.net/item/awning-roofing-services-html-template/55499080) | HTML | unverified | author has no browsable Elements portfolio (HTTP 500); title search found nothing, likely ThemeForest-only | unverified |
| roofing_remodel-7 | [Cityroof - Roofing & Construction HTML](https://themeforest.net/item/cityroof-roofing-services-construction-html-template/62424674) | HTML | no | not in author's Elements web-templates portfolio (119 items crawled) or title search | unverified |
| roofing_remodel-8 | [Roofora - Roofing Services HTML](https://themeforest.net/item/roofora-roofing-services-html-template/62865126) | HTML | yes | [roofora-roofing-services-html-template-AB7LTFV](https://elements.envato.com/roofora-roofing-services-html-template-AB7LTFV) | unverified |
| roofing_remodel-9 | [Renofix - Renovation Building & Painting HTML](https://themeforest.net/item/renofix-renovation-building-painting-html-template/61091731) | HTML | unverified | author has no browsable Elements portfolio (HTTP 500); title search found nothing, likely ThemeForest-only | unverified |
| roofing_remodel-10 | [Rezon - Renovation & Maintenance HTML](https://themeforest.net/item/rezon-renovation-maintenance-services-html-template/28369624) | HTML | unverified | author has no browsable Elements portfolio (HTTP 500); title search found nothing, likely ThemeForest-only | unverified |

### real_estate

| Shortlist id | Title | Type | On Elements | Elements URL / note | ThemeForest Regular price |
|---|---|---|---|---|---|
| real_estate-1 | [Houzez - Real Estate](https://themeforest.net/item/houzez-real-estate-wordpress-theme/15752549) | WP | unverified | author has no browsable Elements portfolio (HTTP 500); title search found nothing, likely ThemeForest-only | unverified |
| real_estate-2 | [MyHome - Real Estate](https://themeforest.net/item/myhome-real-estate-wordpress-theme/19508653) | WP | unverified | author has no browsable Elements portfolio (HTTP 500); title search found nothing, likely ThemeForest-only | unverified |
| real_estate-3 | [Residence Real Estate](https://themeforest.net/item/wp-residence-real-estate-wordpress-theme/7896392) | WP | unverified | author has no browsable Elements portfolio (HTTP 500); title search found nothing, likely ThemeForest-only | unverified |
| real_estate-7 | [Landor – Real Estate & Property Listing HTML](https://themeforest.net/item/landor-modern-real-estate-property-listing-html-template/63048523) | HTML | yes | [landor-modern-real-estate-property-listing-html-NT2YTWC](https://elements.envato.com/landor-modern-real-estate-property-listing-html-NT2YTWC) | unverified |
| real_estate-8 | [Fido - Real Estate & Housing Bootstrap 5](https://themeforest.net/item/fido-real-estate-html-template/32260067) | HTML | unverified | author has no browsable Elements portfolio (HTTP 500); title search found nothing, likely ThemeForest-only | unverified |
| real_estate-9 | [Propertya - Real Estate WP](https://themeforest.net/item/propertya-real-estate-wordpress-theme/27293845) | WP | unverified | author has no browsable Elements portfolio (HTTP 500); title search found nothing, likely ThemeForest-only | unverified |
| real_estate-10 | [Beyot - WordPress Real Estate](https://themeforest.net/item/beyot-wordpress-real-estate-theme/19514964) | WP | no | not in author's Elements wordpress portfolio (18 items crawled) or title search | unverified |

### legal

| Shortlist id | Title | Type | On Elements | Elements URL / note | ThemeForest Regular price |
|---|---|---|---|---|---|
| legal-2 | [Advokat - Lawyer & Attorney](https://themeforest.net/item/advokat-lawyer-lawfirm-wordpress-theme/24061684) | WP | no | not in author's Elements wordpress portfolio (4 items crawled) or title search | $59 (Lina 10/12) |
| legal-3 | [Barristar – Lawyer & Law Firm](https://themeforest.net/item/barristar-law-wordpress-theme/23176442) | WP | no | Elements has only the Barristar *Elementor template kit*, not this WP theme | $49 (Lina 10/12) |
| legal-4 | [Jurist - Law Firm & Attorney](https://themeforest.net/item/jurist-law-firm-attorney-wordpress-theme/60020347) | WP | yes | [jurist-ADTV9PE](https://elements.envato.com/jurist-ADTV9PE) | $69 (search summary, unverified) |
| legal-5 | [Liberta - Lawyer and Attorney](https://themeforest.net/item/liberta-lawyer-and-attorney-wordpress-theme/63052541) | WP | unverified | author has no browsable Elements portfolio (HTTP 500); title search found nothing, likely ThemeForest-only | $49 (search summary, unverified) |
| legal-7 | [Legaro - Attorney & Law Firm HTML](https://themeforest.net/item/legaro-attorney-law-firm-html-template/63771379) | HTML | unverified | author has no browsable Elements portfolio (HTTP 500); title search found nothing, likely ThemeForest-only | $29 (search summary, unverified) |
| legal-8 | [Lawsera – Attorney Lawyer HTML5](https://themeforest.net/item/lawsera-lawyer-attorney-law-firm-html5-template/62115645) | HTML | unverified | author has no browsable Elements portfolio (HTTP 500); title search found nothing, likely ThemeForest-only | $7 (search summary, unverified) |
| legal-9 | [Atorn - Law Firm & Attorney Bootstrap 5](https://themeforest.net/item/atorn-law-firm-attorney-html-template/28807752) | HTML | yes | [atorn-law-firm-attorney-website-html-template-C5LUUPF](https://elements.envato.com/atorn-law-firm-attorney-website-html-template-C5LUUPF) | unverified |

### landscaping_lawn

| Shortlist id | Title | Type | On Elements | Elements URL / note | ThemeForest Regular price |
|---|---|---|---|---|---|
| landscaping_lawn-1 | [The Landscaper - Lawn & Landscaping](https://themeforest.net/item/the-landscaper-lawn-landscaping-wp-theme/13460357) | WP | unverified | author has no browsable Elements portfolio (HTTP 500); title search found nothing, likely ThemeForest-only | unverified |
| landscaping_lawn-2 | [Yard - Gardening, Landscaping & Lawn](https://themeforest.net/item/yard-gardening-landscaping-lawn-wordpress-theme/60424313) | WP | yes | [yard-U33Q29X](https://elements.envato.com/yard-U33Q29X) | unverified |
| landscaping_lawn-3 | [Garden HUB - Lawn & Landscaping](https://themeforest.net/item/garden-hub-lawn-landscaping-wordpress-theme/20200747) | WP | yes | [garden-hub-lawn-landscaping-wordpress-theme-QQ3WNDW](https://elements.envato.com/garden-hub-lawn-landscaping-wordpress-theme-QQ3WNDW) | unverified |
| landscaping_lawn-5 | [Gardeno - Gardening and Landscaping](https://themeforest.net/item/gardeno-gardening-and-landscaping-wordpress-theme/60962504) | WP | yes | [gardeno-gardening-landscaping-wordpress-theme-MW4BMYJ](https://elements.envato.com/gardeno-gardening-landscaping-wordpress-theme-MW4BMYJ) | unverified |
| landscaping_lawn-6 | [Leafix – Landscaping & Gardening HTML](https://themeforest.net/item/leafix-landscaping-gardening-services-html-template/63282752) | HTML | yes | [leafix-landscaping-gardening-html-template-E4XSAXK](https://elements.envato.com/leafix-landscaping-gardening-html-template-E4XSAXK) | unverified |
| landscaping_lawn-7 | [Lawnc - Gardening & Landscaping HTML](https://themeforest.net/item/lawnc-gardening-landscaping-html-template/58138239) | HTML | no | not in author's Elements web-templates portfolio (22 items crawled) or title search | unverified |

### auto_repair

| Shortlist id | Title | Type | On Elements | Elements URL / note | ThemeForest Regular price |
|---|---|---|---|---|---|
| auto_repair-1 | [Motormaster - Car Repair & Auto Service](https://themeforest.net/item/motormaster-car-repair-auto-service-wordpress-theme/51744277) | WP | unverified | author has no browsable Elements portfolio (HTTP 500); title search found nothing, likely ThemeForest-only | unverified |
| auto_repair-2 | [Cario – Car Detailing, Shop & Repair](https://themeforest.net/item/cario-car-detailing-shop-repair-woocommerce-theme/61494478) | WP | unverified | author has no browsable Elements portfolio (HTTP 500); title search found nothing, likely ThemeForest-only | unverified |
| auto_repair-3 | [Car Service - Mechanic & Auto Repair](https://themeforest.net/item/car-service-mechanic-auto-shop-wordpress-theme/12777824) | WP | no | not in author's Elements wordpress portfolio (14 items crawled) or title search | unverified |
| auto_repair-4 | [Auto Macchina - Mechanic & Car Repair](https://themeforest.net/item/macchina-auto-repair-wordpress/32947899) | WP | yes | [car-repair-mechanic-auto-service-garage-shop-9HL8V3H](https://elements.envato.com/car-repair-mechanic-auto-service-garage-shop-9HL8V3H) — Elements title differs: 'Car Repair Mechanic Auto Service Garage Shop' (vamtam), page names Auto Macchina | unverified |
| auto_repair-5 | [Cras - Car Repair & Auto Services HTML](https://themeforest.net/item/cras-car-repair-auto-services-html-template/51209509) | HTML | yes | [cras-car-repair-auto-services-html-template-J4WSRH8](https://elements.envato.com/cras-car-repair-auto-services-html-template-J4WSRH8) | unverified |
| auto_repair-6 | [Servixa – Car Repair & Auto Services HTML5](https://themeforest.net/item/servixa-car-repair-auto-services-html5-template/59914249) | HTML | yes | [servixa-car-repair-html5-template-VJYUEYT](https://elements.envato.com/servixa-car-repair-html5-template-VJYUEYT) | unverified |
| auto_repair-7 | [Autoexpert - Car Repair & Services HTML](https://themeforest.net/item/autoexpert-car-repair-services-html-template/58737134) | HTML | yes | [autoexpert-car-repair-services-html-template-YWQXKGB](https://elements.envato.com/autoexpert-car-repair-services-html-template-YWQXKGB) | unverified |

### salon_barber

| Shortlist id | Title | Type | On Elements | Elements URL / note | ThemeForest Regular price |
|---|---|---|---|---|---|
| salon_barber-1 | [Justache - Barbers & Salons](https://themeforest.net/item/justache-wordpress-theme-for-barbers-salons/35706597) | WP | unverified | author has no browsable Elements portfolio (HTTP 500); title search found nothing, likely ThemeForest-only | $39 (Lina 10/12) |
| salon_barber-2 | [Nelson - Barbershop, Hairdresser & Tattoo](https://themeforest.net/item/nelson-barbershop-tattoo-wordpress-theme/24525732) | WP | no | not in author's Elements wordpress portfolio (199 items crawled) or title search | unverified |
| salon_barber-3 | [Dream Salon - Hair Salon, Beauty Spa](https://themeforest.net/item/dreamsalon-hair-salon-beauty-spa-wordpress-theme/62672874) | WP | unverified | author has no browsable Elements portfolio (HTTP 500); title search found nothing, likely ThemeForest-only | unverified |
| salon_barber-6 | [Kre8 / Barber & Hair Salon HTML](https://themeforest.net/item/kre8-barber-hair-salon-html-template/65099282) | HTML | unverified | author has no browsable Elements portfolio (HTTP 500); title search found nothing, likely ThemeForest-only | $39 (Lina 10/12) |
| salon_barber-7 | [Barberon – Barbershop & Hair Salon HTML](https://themeforest.net/item/barberon-barbershop-hair-salon-html-template/64529617) | HTML | yes | [barberon-barbershop-hair-salon-web-template-NZUJCEM](https://elements.envato.com/barberon-barbershop-hair-salon-web-template-NZUJCEM) | $15 (search summary, unverified) |
| salon_barber-8 | [Trimly - Barbershop & Hair Salon HTML](https://themeforest.net/item/trimly-barbershop-hair-salon-html-template/62382528) | HTML | yes | [trimly-barbershop-hair-salon-html-template-2K67Z4Q](https://elements.envato.com/trimly-barbershop-hair-salon-html-template-2K67Z4Q) | $29 (search summary, unverified) |

### fitness

| Shortlist id | Title | Type | On Elements | Elements URL / note | ThemeForest Regular price |
|---|---|---|---|---|---|
| fitness-1 | [GymBase - Gym Fitness](https://themeforest.net/item/gymbase-responsive-gym-fitness-wordpress-theme/2732248) | WP | no | not in author's Elements wordpress portfolio (14 items crawled) or title search | unverified |
| fitness-2 | [GYM / Gym WordPress Theme + Online Store](https://themeforest.net/item/gym-sport-fitness-club-wordpress-theme/12016226) | WP | no | generic name; no matching axiomthemes item found | unverified |
| fitness-4 | [Stronger - Gym and Fitness](https://themeforest.net/item/stronger-gym-and-fitness-theme/45610553) | WP | unverified | author has no browsable Elements portfolio (HTTP 500); title search found nothing, likely ThemeForest-only | unverified |
| fitness-5 | [CoreHit - Gym & Fitness](https://themeforest.net/item/corehit-gym-fitness-wordpress-theme/62540525) | WP | unverified | author has no browsable Elements portfolio (HTTP 500); title search found nothing, likely ThemeForest-only | unverified |
| fitness-7 | [Gympro - Fitness and Gym HTML](https://themeforest.net/item/gympro-fitness-and-gym-html-template/61703526) | HTML | unverified | author has no browsable Elements portfolio (HTTP 500); title search found nothing, likely ThemeForest-only | unverified |

### insurance_tax

| Shortlist id | Title | Type | On Elements | Elements URL / note | ThemeForest Regular price |
|---|---|---|---|---|---|
| insurance_tax-2 | [Fountax – Tax Advisor (Gutenverse FSE)](https://themeforest.net/item/fountax-tax-advisor-financial-consulting-fse-wordpress-theme/57286102) | WP | yes | [fountax-tax-advisor-consulting-wordpress-theme-XH35EXS](https://elements.envato.com/fountax-tax-advisor-consulting-wordpress-theme-XH35EXS) | unverified |
| insurance_tax-4 | [Liability / Insurance & Risk Management](https://themeforest.net/item/liability-insurance-finance-wordpress-theme/51587919) | WP | yes | [liability-LNZ7D4N](https://elements.envato.com/liability-LNZ7D4N) | unverified |
| insurance_tax-7 | [Urane - Insurance HTML](https://themeforest.net/item/urane-insurance-company-html-template/52892169) | HTML | yes | [urane-insurance-agency-html-template-L4XGW6A](https://elements.envato.com/urane-insurance-agency-html-template-L4XGW6A) | unverified |

### church

| Shortlist id | Title | Type | On Elements | Elements URL / note | ThemeForest Regular price |
|---|---|---|---|---|---|
| church-1 | [Faith Connect - Religion & Church](https://themeforest.net/item/faith-connect-religion-church-wordpress-theme/57177995) | WP | no | not in author's Elements wordpress portfolio (84 items crawled) or title search | unverified |
| church-6 | [Blesso / Nonprofit Church HTML](https://themeforest.net/item/blesso-multipurpose-nonprofit-church-html-template/33910548) | HTML | yes | [blesso-multipurpose-nonprofit-church-html-KU3XZAL](https://elements.envato.com/blesso-multipurpose-nonprofit-church-html-KU3XZAL) | unverified |
| church-7 | [Preypoint - Church and Religion HTML](https://themeforest.net/item/preypoint-church-and-religion-html-template/56208334) | HTML | unverified | author has no browsable Elements portfolio (HTTP 500); title search found nothing, likely ThemeForest-only | unverified |

### child_care

| Shortlist id | Title | Type | On Elements | Elements URL / note | ThemeForest Regular price |
|---|---|---|---|---|---|
| child_care-1 | [Kiddin - Kindergarten & Preschool](https://themeforest.net/item/kiddin-kindergarten-preschool-wordpress-theme/61344716) | WP | unverified | author has no browsable Elements portfolio (HTTP 500); title search found nothing, likely ThemeForest-only | unverified |
| child_care-2 | [KidsCenter - Kindergarten and Kid Care](https://themeforest.net/item/kidscenter-kindergarten-and-kid-care-education-wordpress-theme/54986433) | WP | yes | [kidscenter-kid-care-education-wordpress-theme-PAMANMQ](https://elements.envato.com/kidscenter-kid-care-education-wordpress-theme-PAMANMQ) | unverified |
| child_care-3 | [Little Sprouts – Kindergarten & Preschool](https://themeforest.net/item/little-sprouts-kindergarten-preschool-wordpress-theme/59944020) | WP | unverified | author has no browsable Elements portfolio (HTTP 500); title search found nothing, likely ThemeForest-only | unverified |
| child_care-4 | [Kidden - Children Kindergarten](https://themeforest.net/item/kidden-children-kindergarten-wordpress-theme/54169512) | WP | no | not in author's Elements wordpress portfolio (4 items crawled) or title search | unverified |
| child_care-5 | [Kidzieo - Kindergarten School](https://themeforest.net/item/kidzieo-kindergarten-school-wordpress-theme/49537688) | WP | unverified | author has no browsable Elements portfolio (HTTP 500); title search found nothing, likely ThemeForest-only | unverified |
| child_care-7 | [Ketan - Childcare & Kids School Bootstrap 5](https://themeforest.net/item/ketan-childcarekindergartenhtmltemplate/29115794) | HTML | unverified | author has no browsable Elements portfolio (HTTP 500); title search found nothing, likely ThemeForest-only | unverified |

### pet_care

| Shortlist id | Title | Type | On Elements | Elements URL / note | ThemeForest Regular price |
|---|---|---|---|---|---|
| pet_care-3 | [Petona - Pet Care](https://themeforest.net/item/petona-veterinary-pet-care-clinic-wordpress-theme/61091719) | WP | unverified | author has no browsable Elements portfolio (HTTP 404); title search found nothing, likely ThemeForest-only | unverified |
| pet_care-4 | [Pawpals - Pet Care & Pet Shop](https://themeforest.net/item/pawpals-pet-care-pet-shop-wordpress-theme/52446130) | WP | unverified | author has no browsable Elements portfolio (HTTP 500); title search found nothing, likely ThemeForest-only | unverified |
| pet_care-6 | [Pet Clinic - Veterinary Bootstrap 5](https://themeforest.net/item/pet-clinic-veterinary-responsive-html-template/21037880) | HTML | unverified | author has no browsable Elements portfolio (HTTP 500); title search found nothing, likely ThemeForest-only | unverified |

### event_venue

| Shortlist id | Title | Type | On Elements | Elements URL / note | ThemeForest Regular price |
|---|---|---|---|---|---|
| event_venue-1 | [Grenda - Event Planner](https://themeforest.net/item/grenda-event-planner-wordpress-theme/21835152) | WP | unverified | author has no browsable Elements portfolio (HTTP 500); title search found nothing, likely ThemeForest-only | unverified |
| event_venue-2 | [Unica - Event Planning & Wedding](https://themeforest.net/item/unica-event-planning-agency-theme/13745411) | WP | no | not in author's Elements wordpress portfolio (183 items crawled) or title search | unverified |
| event_venue-6 | [Florya - Wedding and Event Planner](https://themeforest.net/item/florya-wedding-and-event-planner-template/38730565) | HTML | no | not in author's Elements web-templates portfolio (17 items crawled) or title search | unverified |
| event_venue-7 | [Weddingo - Wedding & Planner HTML](https://themeforest.net/item/weddingo-wedding-planner-html-template/60599691) | HTML | yes | [weddingo-wedding-planner-html-template-B43U89G](https://elements.envato.com/weddingo-wedding-planner-html-template-B43U89G) | unverified |

### other_local

| Shortlist id | Title | Type | On Elements | Elements URL / note | ThemeForest Regular price |
|---|---|---|---|---|---|
| other_local-1 | [Novlo – Multipurpose Services](https://themeforest.net/item/novlo-multipurpose-services-wordpress-theme/65003814) | WP | no | not in author's Elements wordpress portfolio (25 items crawled) or title search | unverified |
| other_local-2 | [Quartier - Booking & Shop for Local Business](https://themeforest.net/item/quartier-booking-shop-wordpress-theme-for-local-business/64534812) | WP | unverified | author has no browsable Elements portfolio (HTTP 500); title search found nothing, likely ThemeForest-only | unverified |
| other_local-4 | [Pearle - Multipurpose Service & Shop](https://themeforest.net/item/pearle-multipurpose-service-shop-wp-theme/13626338) | WP | unverified | author has no browsable Elements portfolio (HTTP 500); title search found nothing, likely ThemeForest-only | unverified |
| other_local-5 | [Fixino – Handyman & Home Services](https://themeforest.net/item/fixino-ondemand-home-services-repair-wordpress-theme/63992375) | WP | unverified | author has no browsable Elements portfolio (HTTP 500); title search found nothing, likely ThemeForest-only | unverified |
| other_local-6 | [Repio – Handyman Multipurpose HTML](https://themeforest.net/item/repio-handyman-plumber-multipurpose-repairing-service-html-template/61993263) | HTML | yes | [repio-handyman-plumber-multipurpose-repairing-G79TDWK](https://elements.envato.com/repio-handyman-plumber-multipurpose-repairing-G79TDWK) | unverified |
| other_local-7 | [MrHandy – Handyman Multi-Services HTML](https://themeforest.net/item/mrhandy-handyman-multiservices-html-template/30276632) | HTML | unverified | author has no browsable Elements portfolio (HTTP 500); title search found nothing, likely ThemeForest-only | unverified |

## 2. Summary counts by business type
| Business type | Picks | On Elements | Not on Elements | Unverified |
|---|---|---|---|---|
| **cleaning** | 13 | 4 | 6 | 3 |
| restaurant_texmex | 6 | 2 | 1 | 3 |
| food_truck | 6 | 4 | 0 | 2 |
| medical_clinic | 8 | 2 | 4 | 2 |
| dental | 7 | 3 | 1 | 3 |
| hvac | 7 | 3 | 2 | 2 |
| plumbing_electrical | 6 | 3 | 2 | 1 |
| roofing_remodel | 9 | 2 | 3 | 4 |
| real_estate | 7 | 1 | 1 | 5 |
| legal | 7 | 2 | 2 | 3 |
| landscaping_lawn | 6 | 4 | 1 | 1 |
| auto_repair | 7 | 4 | 1 | 2 |
| salon_barber | 6 | 2 | 1 | 3 |
| fitness | 5 | 0 | 2 | 3 |
| insurance_tax | 3 | 3 | 0 | 0 |
| church | 3 | 1 | 1 | 1 |
| child_care | 6 | 1 | 1 | 4 |
| pet_care | 3 | 0 | 0 | 3 |
| event_venue | 4 | 1 | 2 | 1 |
| other_local | 6 | 1 | 1 | 4 |
| **Total** | **125** | **43** | **32** | **50** |

**Cleaning:** 4 of 13 are on Elements, and all 4 are HTML: Cleanu HTML, Cleanify HTML, Clenia HTML, and Tidytouch HTML. **None of the 7 cleaning WordPress picks is confirmed on Elements.** Be Clean, SmartDataSoft Cleaning Services, SmartClean, CleanMate, and AncoraThemes Cleaning Company are "no". Xcleen WP and Cetro are unverified because themesion and pavothemes have no browsable Elements portfolio. Xcleen HTML is also unverified, and Kean HTML is "no". Elements does carry dozens of other cleaning WP themes and Elementor kits (Cleanora by cmsmasters, Cleanu WP by validthemes, Cleener, ClearPress, Kleanix, Cleanze, and more), so the cleaning type could reach 6 or more Elements picks if Lina shortlists from Elements directly.

**Overall:** 43 of 125 picks (34%) are confirmed on Elements, 32 are confirmed not on Elements, and 50 are unverified (probably ThemeForest-only). Types already at 3 or more Elements picks: cleaning 4, food_truck 4, landscaping 4, auto_repair 4, dental 3, hvac 3, plumbing_electrical 3, insurance_tax 3. **No type reaches the approved minimum of 6 from the overlap alone.** fitness and pet_care have 0.

## 3. ThemeForest Regular price ranges (picks not confirmed on Elements: "no" + "unverified")
Of the 82 such picks, 29 have a known price. The other 53 are unverified.
- **HTML (7 priced):** $7–$49, median about $25. With search-summary prices left out, $12–$49 (Kean $12, Medin $19, Xcleen HTML $25, Kre8 $39, Arctiq $49). Most are $12–$29.
- **WordPress (22 priced):** $35–$79, median **$59**. Most sit at $49–$69: SmartDataSoft $50, Cetro $49, Xcleen $59, Be Clean $59, SmartClean $69, Cleaning Company $69, CleanMate $79, Airz $75.
- Elements picks cost about the same on ThemeForest (HTML $8–$29, WP $45–$69), so these ranges aren't skewed by which items happen to be on Elements.
- All prices are single-site Regular licenses. An Extended license, for an end product that's sold to end users, costs much more and isn't covered here.

## 4. Elements API finding
- **Envato's public API (Market API, `api.envato.com`) covers only the Envato Market sites: ThemeForest, CodeCanyon, and the rest.** Its method list (catalog search, item lookup, item prices, user, author) has no Elements endpoints. Source: https://build.envato.com/api/
- **No public Elements catalog API.** Third-party API directories list an "Envato Elements **Affiliate** API" (base `elements.envato.com/api`) as *affiliate-only, search and metadata for affiliate properties, not a general-purpose API*. Sources: https://apis.io/apis/envato/elements-affiliate/ and https://github.com/api-evangelist/envato/blob/main/apis.yml. Envato's own docs URL for it, https://elements.envato.com/affiliates, **returns 404 today**, so I couldn't confirm the affiliate API on an Envato page or the terms for using it (**unverified**).
- **Closest official option:** Envato's **MCP server** (`https://mcp.envato.com/mcp`), which Envato calls an "early proof-of-concept". It does structured catalog search across the Envato library with filters and returns titles, categories, metadata, and item links. Downloading is "not currently" supported. Source: https://elements.envato.com/learn/envato-mcp-server (3 Jul 2026). It's made for AI assistants. The post doesn't document rate limits, terms for app use, or whether it separates Elements items from Market items, so treating it as a build dependency is **unverified and risky**.
- **What this means for the build:** the Market API can keep feeding ThemeForest data (prices, metadata), but **Elements availability can't come from a supported public API**. It has to be a hand-maintained flag (for example the URL column in this file), re-checked from public Elements pages, or (unconfirmed) taken from the MCP proof-of-concept.

## 5. Recommendation: hybrid, Elements-first
**Build the picker around a hybrid.** Show a "covered by our Elements subscription" set first. Keep per-item ThemeForest Regular licenses as the fallback for the rest of each type's 6.

Reasoning:
- **Elements only isn't enough today.** The overlap is 43 of 125, no type reaches 6, and fitness and pet_care have none. Cutting the picker down to the overlap would break the approved rule of at least 6 per type. Lina could close the gap by adding Elements-native picks (cleaning alone has dozens), but that means a new shortlist pass and her approval.
- **Per-item only throws away what the subscription already pays for.** On Elements, an item costs nothing extra per site: each client site is registered as its own project, so the marginal cost is about $0 within the existing subscription. The subscription fee itself isn't verified here.
- **Per-site cost:**
  - **Elements pick:** about **$0 marginal**, plus one project registration per site.
  - **ThemeForest HTML pick:** usually **$12–$29**, up to $49 (one Regular license per site).
  - **ThemeForest WordPress pick:** usually **$49–$69**, median $59, up to $79.
  - A client switching templates after purchase costs another license for ThemeForest picks and about $0 for Elements picks. That's another reason to put Elements picks first. Who pays for a switch is still OPEN on the card.
- **Data plumbing:** keep the Market API for ThemeForest metadata and prices. Store `on_elements` and `elements_url` per shortlist item as curated data, since there's no supported public Elements API, and re-check them on a schedule. Treat the MCP server as an experiment, not a dependency.
- **Next steps (need Lina or Ezequiel):** (1) Lina adds Elements-native picks so each type gets as many Elements options as possible, starting with cleaning WordPress. (2) Re-check the 50 unverified items. A logged-in Elements search or the API could settle them, once a token-safe wrapper exists. (3) Ezequiel decides whether ThemeForest-only picks stay in client-facing option B or only in Lina's option A.
