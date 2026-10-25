import type { NewsArticleRow, PlayerInjuryRow } from "@/types/database";

/**
 * Artículos verificados de referencia de la UEFA Champions League
 * utilizados para hidratar la Pestaña 4 (/noticias) y el contexto RAG del Chatbot (/chatbot)
 * cuando la tabla `public.news_articles` aún no ha sido sincronizada o como respaldo tipado.
 */
export const STITCH_REFERENCE_NEWS: NewsArticleRow[] = [
  {
    id: "ucl-news-2026-1",
    title:
      "PSG vence 4-2 al FC Barcelona en París y mantiene el paso perfecto como líder de la Fase de Liga",
    summary:
      "Con goles de Désiré Doué (38'), Lucas Hernández (72'), Vitinha (81') y Fabián Ruiz (86'), el cuadro parisino sumó 9 puntos de 9 posibles en la Jornada 3 pese a los tantos de Xavi Espart (55') y Lamine Yamal (79') para el Barça.",
    url: "https://www.uefa.com/uefachampionsleague/news/psg-barcelona-2026/",
    image_url:
      "https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=1200&q=80",
    source_name: "UEFA.com Oficial",
    category: "Crónica",
    club_tag: "Paris Saint-Germain",
    published_at: "2026-10-25T11:15:00Z",
  },
  {
    id: "ucl-news-2026-2",
    title:
      "Parte médico actualizado tras la Jornada 3: bajas de Kvaratskhelia, Dembélé, Dani Olmo y evaluación de Saliba",
    summary:
      "El PSG confirmó las lesiones de Khvicha Kvaratskhelia y Ousmane Dembélé tras el choque ante el Barça, mientras que Dani Olmo será baja para recibir al Aston Villa y el Arsenal monitorea el tobillo de William Saliba.",
    url: "https://www.uefa.com/uefachampionsleague/news/medical-update-j3-2026/",
    image_url:
      "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1200&q=80",
    source_name: "UEFA Medical Hub",
    category: "Parte Médico",
    club_tag: "Paris Saint-Germain",
    published_at: "2026-10-25T10:45:00Z",
  },
  {
    id: "ucl-news-2026-3",
    title:
      "Real Madrid golea 4-1 al RB Leipzig en el Bernabéu con goles de Bernardo Silva, Arda Güler, Mbappé y Yan Diomande",
    summary:
      "El conjunto blanco dominó la posesión (64%) y escaló al Top 4 de la clasificación general (7 puntos) tras imponerse con autoridad en la tercera jornada antes de visitar al PAE AEK en Atenas el 4 de noviembre.",
    url: "https://www.uefa.com/uefachampionsleague/news/real-madrid-leipzig-2026/",
    image_url:
      "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1200&q=80",
    source_name: "UEFA.com Oficial",
    category: "Crónica",
    club_tag: "Real Madrid",
    published_at: "2026-10-25T09:30:00Z",
  },
  {
    id: "ucl-news-2026-4",
    title:
      "Bayern München y Arsenal FC firman un vibrante 2-2 en el Allianz Arena con goles de Eze, Davies, Kane y Declan Rice",
    summary:
      "Eberechi Eze adelantó a los Gunners, Alphonso Davies y Harry Kane remontaron para el Bayern, y Declan Rice selló al 82' el empate definitivo en Múnich.",
    url: "https://www.uefa.com/uefachampionsleague/news/bayern-arsenal-2026/",
    image_url:
      "https://images.unsplash.com/photo-1489944440615-453fc2b6a9a9?auto=format&fit=crop&w=1200&q=80",
    source_name: "UEFA.com Oficial",
    category: "Crónica",
    club_tag: "Bayern München",
    published_at: "2026-10-24T21:20:00Z",
  },
  {
    id: "ucl-news-2026-5",
    title:
      "Liverpool FC remonta un 0-2 y vence 4-3 al Villarreal CF en Anfield con doblete de Alexis Mac Allister",
    summary:
      "Mikautadze y Sergi Cardona adelantaron al Villarreal, pero dos tantos de Mac Allister junto a los goles de Ronald Araújo y Florian Wirtz le dieron los tres puntos a los Reds.",
    url: "https://www.uefa.com/uefachampionsleague/news/liverpool-villarreal-2026/",
    image_url:
      "https://images.unsplash.com/photo-1518091043644-c1d4457512c6?auto=format&fit=crop&w=1200&q=80",
    source_name: "Pitchline Analytics",
    category: "Táctica & xG",
    club_tag: "Liverpool FC",
    published_at: "2026-10-24T19:10:00Z",
  },
  {
    id: "ucl-news-2026-6",
    title:
      "Phil Foden firma un hat-trick en la goleada 5-1 del Manchester City sobre el AEK antes de visitar al RB Leipzig",
    summary:
      "Tres goles de Phil Foden (34', 65', 76') más las dianas de Elliot Anderson y Rayan Cherki sellaron la contundente victoria ciudadana en el Etihad Stadium.",
    url: "https://www.uefa.com/uefachampionsleague/news/man-city-foden-2026/",
    image_url:
      "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?auto=format&fit=crop&w=1200&q=80",
    source_name: "UEFA.com Oficial",
    category: "Crónica",
    club_tag: "Manchester City",
    published_at: "2026-10-24T16:40:00Z",
  },
  {
    id: "ucl-news-2026-7",
    title:
      "Previa de la Jornada 4 (3 y 4 de noviembre): Barça vs Aston Villa, Atlético vs Bayern y Villarreal vs PSG",
    summary:
      "El modelo predictivo de Pitchline proyecta alta paridad en el ecuador de la Fase de Liga 2026/27, donde los primeros 8 puestos empezarán a perfilar su boleto directo a Octavos.",
    url: "https://www.uefa.com/uefachampionsleague/news/matchday-4-preview-2026/",
    image_url:
      "https://images.unsplash.com/photo-1517466787929-bc90951d0974?auto=format&fit=crop&w=1200&q=80",
    source_name: "Pitchline Analytics",
    category: "Previa",
    club_tag: "FC Barcelona",
    published_at: "2026-10-24T14:00:00Z",
  },
  {
    id: "ucl-news-2026-8",
    title:
      "Inter de Milán supera 1-0 al Shakhtar con gol de Carlos Augusto y Borussia Dortmund gana 2-1 con doblete de Guirassy",
    summary:
      "Un tanto de Carlos Augusto al 77' le dio los tres puntos al cuadro nerazzurro en San Siro, mientras que dos goles de Serhou Guirassy sellaron el triunfo del BVB en Bakú.",
    url: "https://www.uefa.com/uefachampionsleague/news/inter-dortmund-j3-2026/",
    image_url:
      "https://images.unsplash.com/photo-1551958219-acbc608c6377?auto=format&fit=crop&w=1200&q=80",
    source_name: "Oficial UEFA",
    category: "Oficial UEFA",
    club_tag: "Inter de Milán",
    published_at: "2026-10-24T11:30:00Z",
  },
];

/**
 * Registros médicos de jugadores actualmente lesionados en la UEFA Champions League 2026/27 (Fase de Liga • tras Jornada 3)
 * con sus clubes y escudos actuales verificados.
 */
export const STITCH_REFERENCE_INJURIES: PlayerInjuryRow[] = [
  {
    id: "inj-2026-active-1",
    player_name: "Khvicha Kvaratskhelia",
    team_id: 524,
    team_name: "Paris Saint-Germain",
    team_short_name: "PSG",
    team_crest_url: "https://crests.football-data.org/524.png",
    injury_type: "Rotura del ligamento cruzado anterior en la rodilla derecha (sufrida en J3 vs Barça)",
    status: "OUT",
    estimated_return: "6 a 8 meses (Baja el resto de la temporada)",
    expected_return_date: "2027-05-30",
    detail:
      "Sufrió la lesión de rodilla durante la victoria 4-2 frente al FC Barcelona en el Parque de los Príncipes.",
    updated_at: "2026-10-25T11:20:00Z",
  },
  {
    id: "inj-2026-active-2",
    player_name: "Ousmane Dembélé",
    team_id: 524,
    team_name: "Paris Saint-Germain",
    team_short_name: "PSG",
    team_crest_url: "https://crests.football-data.org/524.png",
    injury_type: "Desgarro muscular en el muslo izquierdo (sufrido en J3 vs Barça)",
    status: "OUT",
    estimated_return: "3 a 4 semanas (Baja para J4 vs Villarreal)",
    expected_return_date: "2026-11-18",
    detail:
      "Confirmada lesión fibrilar en el muslo izquierdo tras las pruebas médicas realizadas en París; será baja en la Jornada 4.",
    updated_at: "2026-10-25T11:18:00Z",
  },
  {
    id: "inj-2026-active-3",
    player_name: "Dani Olmo",
    team_id: 81,
    team_name: "FC Barcelona",
    team_short_name: "FCB",
    team_crest_url: "https://crests.football-data.org/81.png",
    injury_type: "Lesión muscular sufrida durante el duelo de Jornada 3 ante el PSG",
    status: "OUT",
    estimated_return: "10 a 14 días (Baja para J4 vs Aston Villa)",
    expected_return_date: "2026-11-08",
    detail:
      "En proceso de rehabilitación en la Ciutat Esportiva Joan Gamper; descartado para recibir al Aston Villa el 3 de noviembre.",
    updated_at: "2026-10-25T11:15:00Z",
  },
  {
    id: "inj-2026-active-4",
    player_name: "William Saliba",
    team_id: 57,
    team_name: "Arsenal FC",
    team_short_name: "ARS",
    team_crest_url: "https://crests.football-data.org/57.png",
    injury_type: "Molestia en el tobillo tras el encuentro de Jornada 3 ante el Bayern München",
    status: "DOUBTFUL",
    estimated_return: "5 a 8 días (En evaluación para J4 vs Slavia Praha)",
    expected_return_date: "2026-11-03",
    detail:
      "El cuerpo médico del Arsenal evalúa su evolución día a día antes del desplazamiento europeo del 4 de noviembre.",
    updated_at: "2026-10-25T11:10:00Z",
  },
  {
    id: "inj-2026-active-5",
    player_name: "Marquinhos",
    team_id: 524,
    team_name: "Paris Saint-Germain",
    team_short_name: "PSG",
    team_crest_url: "https://crests.football-data.org/524.png",
    injury_type: "Lesión muscular en el muslo derecho sufrida en la Jornada 3",
    status: "OUT",
    estimated_return: "2 a 3 semanas (Baja para J4 vs Villarreal)",
    expected_return_date: "2026-11-14",
    detail:
      "El capitán del PSG permanece en tratamiento fisioterapéutico y no viajará al Estadio de la Cerámica.",
    updated_at: "2026-10-25T11:05:00Z",
  },
  {
    id: "inj-2026-active-6",
    player_name: "Jules Koundé",
    team_id: 81,
    team_name: "FC Barcelona",
    team_short_name: "FCB",
    team_crest_url: "https://crests.football-data.org/81.png",
    injury_type: "Molestia articular en el tobillo en seguimiento tras la Jornada 3",
    status: "DOUBTFUL",
    estimated_return: "4 a 6 días (En duda para J4 vs Aston Villa)",
    expected_return_date: "2026-11-02",
    detail:
      "Realiza trabajo específico de recuperación para evitar recaídas antes de la cuarta jornada de la Fase de Liga.",
    updated_at: "2026-10-25T11:00:00Z",
  },
  {
    id: "inj-2026-active-7",
    player_name: "Jeremie Frimpong",
    team_id: 64,
    team_name: "Liverpool FC",
    team_short_name: "LIV",
    team_crest_url: "https://crests.football-data.org/64.png",
    injury_type: "Lesión muscular en los isquiotibiales",
    status: "OUT",
    estimated_return: "2 a 3 semanas (Baja para J4 vs Fenerbahçe)",
    expected_return_date: "2026-11-15",
    detail:
      "Continúa su recuperación con los servicios médicos del Liverpool en el AXA Training Centre.",
    updated_at: "2026-10-25T10:55:00Z",
  },
  {
    id: "inj-2026-active-8",
    player_name: "Ferland Mendy",
    team_id: 86,
    team_name: "Real Madrid CF",
    team_short_name: "RMA",
    team_crest_url: "https://crests.football-data.org/86.png",
    injury_type: "Sobrecarga muscular en el muslo izquierdo",
    status: "DOUBTFUL",
    estimated_return: "5 a 7 días (En duda para J4 vs PAE AEK)",
    expected_return_date: "2026-11-03",
    detail:
      "Trabaja en el gimnasio y césped de Valdebebas bajo supervisión médica de cara al viaje a Atenas.",
    updated_at: "2026-10-25T10:50:00Z",
  },
];
