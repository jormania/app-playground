/**
 * Demo wardrobe. With no Notion token the app serves these instead of calling
 * out — the same "no token ⇒ fixtures" pattern WhereItWent uses (`_demoOr`), so
 * Fit Check is fully explorable before anything is configured.
 *
 * Every tag here is a registered option in lib/vocabulary.ts; `demoData.test.ts`
 * enforces that, so the fixtures can't drift from what Notion would accept.
 *
 * `thumb` values are flat average colours rather than base64 JPEGs — enough for
 * the grid to paint honestly without carrying a megabyte of fixtures. Real rows
 * get a true LQIP at upload time (Milestone 2).
 */
import type { Garment, Outfit } from '../lib/types.ts'

export const DEMO_GARMENTS: Garment[] = [
  {
    id: 'demo_g_white_tee', name: 'White cotton tee', photoUrl: null, thumb: '#efeae1',
    category: 'Top', colours: ['white'], warmth: 'Light', styles: ['casual', 'layering'],
    home: 'Both', favourite: true, wearCount: 24, lastWorn: '2026-08-02', active: true,
  },
  {
    id: 'demo_g_striped_tee', name: 'Blue striped tee', photoUrl: null, thumb: '#8fa9c4',
    category: 'Top', colours: ['blue', 'white'], warmth: 'Light', styles: ['casual', 'summery'],
    home: 'Home A', favourite: false, wearCount: 11, lastWorn: '2026-07-28', active: true,
  },
  {
    id: 'demo_g_black_hoodie', name: 'Black hoodie', photoUrl: null, thumb: '#2b2b2f',
    category: 'Top', colours: ['black'], warmth: 'Warm', styles: ['cosy', 'casual', 'layering'],
    home: 'Both', favourite: true, wearCount: 31, lastWorn: '2026-08-04', active: true,
  },
  {
    id: 'demo_g_green_knit', name: 'Green cable knit', photoUrl: null, thumb: '#5c7a5c',
    category: 'Top', colours: ['green'], warmth: 'Warm', styles: ['cosy', 'smart'],
    home: 'Home B', favourite: false, wearCount: 6, lastWorn: '2026-03-14', active: true,
  },
  {
    id: 'demo_g_blue_jeans', name: 'Blue jeans', photoUrl: null, thumb: '#4a6182',
    category: 'Bottom', colours: ['denim', 'blue'], warmth: 'Mid', styles: ['casual', 'school'],
    home: 'Both', favourite: true, wearCount: 40, lastWorn: '2026-08-05', active: true,
  },
  {
    id: 'demo_g_black_jeans', name: 'Black skinny jeans', photoUrl: null, thumb: '#26262b',
    category: 'Bottom', colours: ['black'], warmth: 'Mid', styles: ['casual', 'going-out'],
    home: 'Home A', favourite: false, wearCount: 18, lastWorn: '2026-07-30', active: true,
  },
  {
    id: 'demo_g_cargo_pants', name: 'Beige cargo trousers', photoUrl: null, thumb: '#c4b393',
    category: 'Bottom', colours: ['beige'], warmth: 'Mid', styles: ['casual', 'sporty'],
    home: 'Home B', favourite: false, wearCount: 9, lastWorn: '2026-07-19', active: true,
  },
  {
    id: 'demo_g_denim_skirt', name: 'Denim skirt', photoUrl: null, thumb: '#6b86a8',
    category: 'Bottom', colours: ['denim'], warmth: 'Light', styles: ['casual', 'summery'],
    home: 'Home A', favourite: false, wearCount: 7, lastWorn: '2026-06-22', active: true,
  },
  {
    id: 'demo_g_floral_dress', name: 'Floral summer dress', photoUrl: null, thumb: '#d9a3ab',
    category: 'Dress', colours: ['pink', 'multicolour'], warmth: 'Light',
    styles: ['summery', 'going-out'], home: 'Home A', favourite: true,
    wearCount: 5, lastWorn: '2026-07-12', active: true,
  },
  {
    id: 'demo_g_black_dress', name: 'Black pinafore dress', photoUrl: null, thumb: '#232327',
    category: 'Dress', colours: ['black'], warmth: 'Mid', styles: ['smart', 'school'],
    home: 'Both', favourite: false, wearCount: 12, lastWorn: '2026-05-30', active: true,
  },
  {
    id: 'demo_g_denim_jacket', name: 'Denim jacket', photoUrl: null, thumb: '#7590b0',
    category: 'Outerwear', colours: ['denim', 'blue'], warmth: 'Mid',
    styles: ['casual', 'layering'], home: 'Both', favourite: true,
    wearCount: 22, lastWorn: '2026-08-01', active: true,
  },
  {
    id: 'demo_g_puffer', name: 'Navy puffer coat', photoUrl: null, thumb: '#2c3a55',
    category: 'Outerwear', colours: ['navy'], warmth: 'Warm', styles: ['cosy', 'casual'],
    home: 'Home B', favourite: false, wearCount: 28, lastWorn: '2026-02-27', active: true,
  },
  {
    id: 'demo_g_rain_mac', name: 'Yellow rain mac', photoUrl: null, thumb: '#d7b756',
    category: 'Outerwear', colours: ['yellow'], warmth: 'Mid', styles: ['casual', 'layering'],
    home: 'Home A', favourite: false, wearCount: 4, lastWorn: '2026-04-18', active: true,
  },
  {
    id: 'demo_g_white_trainers', name: 'White trainers', photoUrl: null, thumb: '#e8e6e1',
    category: 'Shoes', colours: ['white'], warmth: 'Light', styles: ['casual', 'sporty', 'school'],
    home: 'Both', favourite: true, wearCount: 52, lastWorn: '2026-08-05', active: true,
  },
  {
    id: 'demo_g_chelsea_boots', name: 'Black Chelsea boots', photoUrl: null, thumb: '#1f1f22',
    category: 'Shoes', colours: ['black'], warmth: 'Warm', styles: ['smart', 'going-out'],
    home: 'Home A', favourite: false, wearCount: 15, lastWorn: '2026-03-08', active: true,
  },
  {
    id: 'demo_g_sandals', name: 'Tan sandals', photoUrl: null, thumb: '#b99a72',
    category: 'Shoes', colours: ['brown'], warmth: 'Light', styles: ['summery', 'casual'],
    home: 'Home B', favourite: false, wearCount: 8, lastWorn: '2026-07-25', active: true,
  },
  {
    id: 'demo_g_grey_scarf', name: 'Grey wool scarf', photoUrl: null, thumb: '#9a9a9f',
    category: 'Accessory', colours: ['grey'], warmth: 'Warm', styles: ['cosy', 'layering'],
    home: 'Both', favourite: false, wearCount: 19, lastWorn: '2026-02-14', active: true,
  },
  {
    id: 'demo_g_tote', name: 'Cream canvas tote', photoUrl: null, thumb: '#ded3ba',
    category: 'Accessory', colours: ['cream'], warmth: 'Light', styles: ['casual', 'school'],
    home: 'Home A', favourite: true, wearCount: 33, lastWorn: '2026-08-04', active: true,
  },
  // One archived row, so the Active filter has something real to hide.
  {
    id: 'demo_g_old_hoodie', name: 'Old red hoodie', photoUrl: null, thumb: '#8d3f3f',
    category: 'Top', colours: ['red'], warmth: 'Warm', styles: ['cosy'],
    home: 'Home B', favourite: false, wearCount: 47, lastWorn: '2025-11-03', active: false,
  },
]

export const DEMO_OUTFITS: Outfit[] = [
  {
    id: 'demo_o_1', name: 'Tee + jeans + trainers', date: '2026-08-05',
    garmentIds: ['demo_g_white_tee', 'demo_g_blue_jeans', 'demo_g_white_trainers'],
    mood: 'Comfy', weather: '26°C, clear', verdict: 'Worn', favourite: true,
  },
  {
    id: 'demo_o_2', name: 'Hoodie + jeans + trainers', date: '2026-08-04',
    garmentIds: ['demo_g_black_hoodie', 'demo_g_blue_jeans', 'demo_g_white_trainers'],
    mood: 'Low-key', weather: '18°C, overcast', verdict: 'Worn', favourite: false,
  },
  {
    id: 'demo_o_3', name: 'Pinafore + boots', date: '2026-08-03',
    garmentIds: ['demo_g_black_dress', 'demo_g_chelsea_boots'],
    mood: 'Put-together', weather: '21°C, a few clouds', verdict: 'Skipped', favourite: false,
  },
  {
    id: 'demo_o_4', name: 'Floral dress + sandals', date: '2026-08-02',
    garmentIds: ['demo_g_floral_dress', 'demo_g_sandals'],
    mood: 'Confident', weather: '29°C, clear', verdict: 'Worn', favourite: true,
  },
  {
    id: 'demo_o_5', name: 'Striped tee + cargos', date: '2026-08-01',
    garmentIds: ['demo_g_striped_tee', 'demo_g_cargo_pants', 'demo_g_white_trainers'],
    mood: 'Sporty', weather: '23°C, rain', verdict: 'Worn', favourite: false,
  },
]
