// Place names drawn on the built-in map of Armenia (used when street-map tiles are off or cannot load).
// minZoom: the label appears from this zoom level up, so the map is not crowded when zoomed out.
export type Lang = "hy" | "en" | "ru";
export interface Place {
  lat: number;
  lng: number;
  minZoom: number;
  name: Record<Lang, string>;
  kind: "capital" | "city" | "town" | "marz" | "lake";
}

export const PLACES: Place[] = [
  // Provinces (marzer), shown only when zoomed out
  { kind: "marz", lat: 40.902, lng: 45.117, minZoom: 0, name: { hy: "Տավուշ", en: "Tavush", ru: "Тавуш" } },
  { kind: "marz", lat: 40.962, lng: 44.46, minZoom: 0, name: { hy: "Լոռի", en: "Lori", ru: "Лори" } },
  { kind: "marz", lat: 40.892, lng: 43.85, minZoom: 0, name: { hy: "Շիրակ", en: "Shirak", ru: "Ширак" } },
  { kind: "marz", lat: 40.12, lng: 45.42, minZoom: 0, name: { hy: "Գեղարքունիք", en: "Gegharkunik", ru: "Гехаркуник" } },
  { kind: "marz", lat: 39.749, lng: 45.441, minZoom: 0, name: { hy: "Վայոց ձոր", en: "Vayots Dzor", ru: "Вайоц Дзор" } },
  { kind: "marz", lat: 39.35, lng: 46.142, minZoom: 0, name: { hy: "Սյունիք", en: "Syunik", ru: "Сюник" } },
  { kind: "marz", lat: 39.923, lng: 44.812, minZoom: 0, name: { hy: "Արարատ", en: "Ararat", ru: "Арарат" } },
  { kind: "marz", lat: 40.47, lng: 44.1, minZoom: 0, name: { hy: "Արագածոտն", en: "Aragatsotn", ru: "Арагацотн" } },
  { kind: "marz", lat: 40.107, lng: 43.976, minZoom: 0, name: { hy: "Արմավիր", en: "Armavir", ru: "Армавир" } },
  { kind: "marz", lat: 40.45, lng: 44.75, minZoom: 0, name: { hy: "Կոտայք", en: "Kotayk", ru: "Котайк" } },
  { kind: "lake", lat: 40.33, lng: 45.3, minZoom: 8, name: { hy: "Սևանա լիճ", en: "Lake Sevan", ru: "озеро Севан" } },

  // Cities and towns
  { kind: "capital", lat: 40.1831, lng: 44.5116, minZoom: 0, name: { hy: "Երևան", en: "Yerevan", ru: "Ереван" } },
  { kind: "city", lat: 40.7894, lng: 43.8475, minZoom: 8, name: { hy: "Գյումրի", en: "Gyumri", ru: "Гюмри" } },
  { kind: "city", lat: 40.8128, lng: 44.4883, minZoom: 8, name: { hy: "Վանաձոր", en: "Vanadzor", ru: "Ванадзор" } },
  { kind: "city", lat: 40.1653, lng: 44.2936, minZoom: 9, name: { hy: "Վաղարշապատ", en: "Vagharshapat", ru: "Вагаршапат" } },
  { kind: "city", lat: 40.1546, lng: 44.0383, minZoom: 9, name: { hy: "Արմավիր", en: "Armavir", ru: "Армавир" } },
  { kind: "city", lat: 39.9539, lng: 44.5506, minZoom: 9, name: { hy: "Արտաշատ", en: "Artashat", ru: "Арташат" } },
  { kind: "city", lat: 40.4977, lng: 44.7663, minZoom: 9, name: { hy: "Հրազդան", en: "Hrazdan", ru: "Раздан" } },
  { kind: "city", lat: 40.2735, lng: 44.6256, minZoom: 10, name: { hy: "Աբովյան", en: "Abovyan", ru: "Абовян" } },
  { kind: "city", lat: 40.5486, lng: 44.9486, minZoom: 9, name: { hy: "Սևան", en: "Sevan", ru: "Севан" } },
  { kind: "city", lat: 40.3589, lng: 45.1267, minZoom: 9, name: { hy: "Գավառ", en: "Gavar", ru: "Гавар" } },
  { kind: "city", lat: 40.8756, lng: 45.1492, minZoom: 9, name: { hy: "Իջևան", en: "Ijevan", ru: "Иджеван" } },
  { kind: "city", lat: 39.7611, lng: 45.3333, minZoom: 9, name: { hy: "Եղեգնաձոր", en: "Yeghegnadzor", ru: "Ехегнадзор" } },
  { kind: "city", lat: 39.5111, lng: 46.3383, minZoom: 9, name: { hy: "Գորիս", en: "Goris", ru: "Горис" } },
  { kind: "city", lat: 39.2076, lng: 46.4058, minZoom: 9, name: { hy: "Կապան", en: "Kapan", ru: "Капан" } },
  { kind: "town", lat: 40.3017, lng: 44.3592, minZoom: 9, name: { hy: "Աշտարակ", en: "Ashtarak", ru: "Аштарак" } },
  { kind: "town", lat: 40.5933, lng: 44.3589, minZoom: 9, name: { hy: "Ապարան", en: "Aparan", ru: "Апаран" } },
  { kind: "town", lat: 40.3915, lng: 43.8775, minZoom: 9, name: { hy: "Թալին", en: "Talin", ru: "Талин" } },
  { kind: "town", lat: 40.264, lng: 44.313, minZoom: 11, name: { hy: "Օշական", en: "Oshakan", ru: "Ошакан" } },
  { kind: "town", lat: 40.3383, lng: 44.2721, minZoom: 11, name: { hy: "Բյուրական", en: "Byurakan", ru: "Бюракан" } },
  { kind: "town", lat: 40.3301, lng: 44.3755, minZoom: 11, name: { hy: "Կարբի", en: "Karbi", ru: "Карби" } },
];
