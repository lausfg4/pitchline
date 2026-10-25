import type { MatchEventRow, MatchWithDetails } from "@/types/database";

/**
 * Posesión oficial verificada (% local, % visitante) de los 54 partidos disputados
 * en las Jornadas 1, 2 y 3 de la Fase de Liga de la UEFA Champions League 2026/27.
 */
export const OFFICIAL_MATCH_POSSESSION: Record<
  number,
  { home: number; away: number }
> = {
  // Jornada 1 (8, 9 y 10 de septiembre de 2026)
  575323: { home: 64, away: 36 }, // Club Brugge 2-3 Aston Villa
  575324: { home: 54, away: 46 }, // PAE AEK 1-0 LASK
  575325: { home: 38, away: 62 }, // Real Madrid 2-1 Inter
  575326: { home: 28, away: 72 }, // Porto 0-2 Man City
  575327: { home: 52, away: 48 }, // Dortmund 3-2 Villarreal
  575328: { home: 44, away: 56 }, // Lille 2-3 Real Betis
  575329: { home: 71, away: 29 }, // Barça 5-1 Feyenoord
  575330: { home: 62, away: 38 }, // Stuttgart 3-1 Viking
  575331: { home: 45, away: 55 }, // Liverpool 2-1 Atleti
  575332: { home: 72, away: 28 }, // PSG 6-1 Slovan Bratislava
  575333: { home: 42, away: 58 }, // Napoli 0-1 Arsenal
  575334: { home: 38, away: 62 }, // Sporting CP 3-1 Galatasaray
  575335: { home: 42, away: 58 }, // Fenerbahçe 1-1 Roma
  575336: { home: 54, away: 46 }, // PSV 1-1 Shakhtar
  575337: { home: 66, away: 34 }, // Bayern 5-0 Bodø/Glimt
  575338: { home: 58, away: 42 }, // Man United 4-0 Sabah FK
  575339: { home: 51, away: 49 }, // Como 1907 4-1 RB Leipzig
  575340: { home: 37, away: 63 }, // Slavia Praha 2-3 RC Lens

  // Jornada 2 (13 y 14 de octubre de 2026)
  575341: { home: 56, away: 44 }, // RC Lens 0-2 Sporting CP
  575342: { home: 44, away: 56 }, // Sabah FK 2-0 Slavia Praha
  575343: { home: 53, away: 47 }, // Inter 3-4 Club Brugge
  575344: { home: 29, away: 71 }, // Galatasaray 1-4 Barça
  575345: { home: 58, away: 42 }, // Atleti 2-0 Man United
  575346: { home: 59, away: 41 }, // Arsenal 3-0 Lille
  575347: { home: 35, away: 65 }, // Viking 3-3 Bayern
  575348: { home: 43, away: 57 }, // RB Leipzig 1-0 PSV
  575349: { home: 52, away: 48 }, // Villarreal 3-1 Napoli
  575350: { home: 38, away: 62 }, // LASK 3-6 Liverpool
  575351: { home: 47, away: 53 }, // Feyenoord 3-2 Como 1907
  575352: { home: 54, away: 46 }, // Roma 3-4 Real Madrid
  575353: { home: 54, away: 46 }, // Man City 2-4 PSG
  575354: { home: 38, away: 62 }, // Bodø/Glimt 1-0 Dortmund
  575355: { home: 45, away: 55 }, // Aston Villa 6-0 Fenerbahçe
  575356: { home: 56, away: 44 }, // Real Betis 3-2 Porto
  575357: { home: 55, away: 45 }, // Shakhtar 3-1 PAE AEK
  575358: { home: 42, away: 58 }, // Slovan Bratislava 0-3 Stuttgart

  // Jornada 3 (20 y 21 de octubre de 2026)
  575359: { home: 45, away: 55 }, // Sabah FK 1-2 Dortmund
  575360: { home: 49, away: 51 }, // Fenerbahçe 2-2 Slavia Praha
  575361: { home: 64, away: 36 }, // Man City 5-1 PAE AEK
  575362: { home: 54, away: 46 }, // Stuttgart 1-1 Atleti
  575363: { home: 54, away: 46 }, // Liverpool 4-3 Villarreal
  575364: { home: 73, away: 27 }, // Roma 4-0 Slovan Bratislava
  575365: { home: 40, away: 60 }, // Porto 0-1 PSV
  575366: { home: 43, away: 57 }, // Napoli 4-3 Bodø/Glimt
  575367: { home: 47, away: 53 }, // PSG 4-2 Barça
  575368: { home: 55, away: 45 }, // Como 1907 4-1 Man United
  575369: { home: 56, away: 44 }, // Lille 2-4 Galatasaray
  575370: { home: 64, away: 36 }, // Real Madrid 4-1 RB Leipzig
  575371: { home: 45, away: 55 }, // Inter 1-0 Shakhtar
  575372: { home: 43, away: 57 }, // Bayern 2-2 Arsenal
  575373: { home: 57, away: 43 }, // Club Brugge 3-0 RC Lens
  575374: { home: 54, away: 46 }, // Aston Villa 3-1 Viking
  575375: { home: 62, away: 38 }, // Sporting CP 2-3 LASK
  575376: { home: 47, away: 53 }, // Real Betis 1-0 Feyenoord
};

type RawGoalDef = [
  matchId: number,
  minute: number,
  extraMinute: number | null,
  teamId: number,
  playerName: string,
  detail: string
];

const RAW_OFFICIAL_GOALS: RawGoalDef[] = [
  // =========================================================================
  // JORNADA 1 (8, 9 y 10 de septiembre de 2026)
  // =========================================================================
  // 575323: Club Brugge (851) 2 - 3 Aston Villa (58)
  [575323, 11, null, 58, "John McGinn", "Gol de Aston Villa (0-1)"],
  [575323, 19, null, 851, "Hugo Vetlesen", "Gol de Club Brugge (1-1)"],
  [575323, 21, null, 58, "Emiliano Buendía", "Gol de Aston Villa (1-2)"],
  [575323, 34, null, 58, "Nicolas Jackson", "Gol de Aston Villa (1-3)"],
  [575323, 62, null, 851, "Nicolò Tresoldi", "Gol de penalti (2-3)"],

  // 575324: PAE AEK (1899) 1 - 0 LASK (2016)
  [575324, 20, null, 1899, "Răzvan Marin", "Gol de tiro libre directo (1-0)"],

  // 575325: Real Madrid (86) 2 - 1 Inter (108)
  [575325, 18, null, 86, "Kylian Mbappé", "Gol de Real Madrid (1-0)"],
  [575325, 54, null, 108, "Carlos Augusto", "Gol de Inter (1-1)"],
  [575325, 79, null, 86, "Federico Valverde", "Gol de Real Madrid (2-1)"],

  // 575326: Porto (503) 0 - 2 Man City (65)
  [575326, 47, null, 65, "Erling Haaland", "Gol de Manchester City (0-1)"],
  [575326, 90, 3, 65, "Erling Haaland", "Doblete de Haaland (0-2)"],

  // 575327: Dortmund (4) 3 - 2 Villarreal (94)
  [575327, 53, null, 4, "Renato Veiga (p.p.)", "Gol en propia puerta (1-0)"],
  [575327, 66, null, 94, "Santiago Mouriño", "Gol de Villarreal (1-1)"],
  [575327, 80, null, 4, "Serhou Guirassy", "Gol de Borussia Dortmund (2-1)"],
  [575327, 85, null, 4, "Serhou Guirassy", "Gol de penalti (3-1)"],
  [575327, 90, 3, 94, "Serhou Guirassy (p.p.)", "Descuento visitante (3-2)"],

  // 575328: Lille (521) 2 - 3 Real Betis (90)
  [575328, 12, null, 90, "Ayase Ueda", "Gol de Real Betis (0-1)"],
  [575328, 33, null, 90, "Marc Bartra", "Cabezazo de Real Betis (0-2)"],
  [575328, 36, null, 521, "Alexsandro", "Gol de Lille (1-2)"],
  [575328, 46, null, 521, "Ngal'ayel Mukau", "Empate de Lille (2-2)"],
  [575328, 53, null, 90, "Troy Parrott", "Gol de la victoria bética (2-3)"],

  // 575329: Barça (81) 5 - 1 Feyenoord (675)
  [575329, 14, null, 81, "Raphinha", "Gol de FC Barcelona (1-0)"],
  [575329, 29, null, 81, "Karim Adeyemi", "Gol de FC Barcelona (2-0)"],
  [575329, 41, null, 675, "Sem Steijn", "Gol de Feyenoord (2-1)"],
  [575329, 58, null, 81, "Pedri", "Gol de FC Barcelona (3-1)"],
  [575329, 73, null, 81, "Lamine Yamal", "Gol de FC Barcelona (4-1)"],
  [575329, 86, null, 81, "Gabriel Jesus", "Sentencia azulgrana (5-1)"],

  // 575330: Stuttgart (10) 3 - 1 Viking (5720)
  [575330, 20, null, 10, "Ermedin Demirović", "Gol de Stuttgart (1-0)"],
  [575330, 22, null, 5720, "Zlatko Tripić", "Empate de Viking (1-1)"],
  [575330, 26, null, 10, "Ermedin Demirović", "Doblete de Demirović (2-1)"],
  [575330, 32, null, 10, "Ermedin Demirović", "Hat-trick de Demirović (3-1)"],

  // 575331: Liverpool (64) 2 - 1 Atleti (78)
  [575331, 17, null, 78, "Marcos Llorente", "Gol de Atlético de Madrid (0-1)"],
  [575331, 40, null, 64, "Dominik Szoboszlai", "Empate de Liverpool (1-1)"],
  [575331, 50, null, 64, "Alexis Mac Allister", "Remontada en Anfield (2-1)"],

  // 575332: PSG (524) 6 - 1 Slovan Bratislava (7509)
  [575332, 17, null, 524, "Ousmane Dembélé", "Gol de PSG (1-0)"],
  [575332, 23, null, 524, "Ousmane Dembélé", "Doblete de Dembélé (2-0)"],
  [575332, 31, null, 524, "Ferran Torres", "Gol de PSG (3-0)"],
  [575332, 47, null, 524, "Ferran Torres", "Doblete de Ferran Torres (4-0)"],
  [575332, 57, null, 524, "Ferran Torres", "Hat-trick de Ferran Torres (5-0)"],
  [575332, 58, null, 7509, "Suleiman Camara", "Gol de Slovan Bratislava (5-1)"],
  [575332, 87, null, 524, "Fabián Ruiz", "Sexto gol parisino (6-1)"],

  // 575333: Napoli (113) 0 - 1 Arsenal (57)
  [575333, 75, null, 57, "Martin Ødegaard", "Gol de la victoria Gunner (0-1)"],

  // 575334: Sporting CP (498) 3 - 1 Galatasaray (610)
  [575334, 5, null, 610, "Gonçalo Inácio (p.p.)", "Autogol inicial (0-1)"],
  [575334, 27, null, 498, "Geny Catamo", "Empate de Sporting CP (1-1)"],
  [575334, 57, null, 498, "Luis Suárez", "Gol de penalti (2-1)"],
  [575334, 63, null, 498, "Rodrigo Zalazar", "Sentencia en Lisboa (3-1)"],

  // 575335: Fenerbahçe (613) 1 - 1 Roma (100)
  [575335, 39, null, 100, "Bryan Cristante", "Gol de AS Roma (0-1)"],
  [575335, 48, null, 613, "Archie Brown", "Empate de Fenerbahçe (1-1)"],

  // 575336: PSV (674) 1 - 1 Shakhtar (1887)
  [575336, 45, 1, 1887, "Gleiker Mendoza", "Gol de Shakhtar Donetsk (0-1)"],
  [575336, 48, null, 674, "Sergiño Dest", "Empate de PSV Eindhoven (1-1)"],

  // 575337: Bayern (5) 5 - 0 Bodø/Glimt (5721)
  [575337, 47, null, 5, "Jamal Musiala", "Gol de Bayern München (1-0)"],
  [575337, 61, null, 5, "Harry Kane", "Gol de Harry Kane (2-0)"],
  [575337, 77, null, 5, "Alphonso Davies", "Gol de Alphonso Davies (3-0)"],
  [575337, 83, null, 5, "Michael Olise", "Gol de Michael Olise (4-0)"],
  [575337, 90, 2, 5, "Michael Olise", "Doblete de Michael Olise (5-0)"],

  // 575338: Man United (66) 4 - 0 Sabah FK (10233)
  [575338, 27, null, 66, "Matheus Cunha", "Gol de Manchester United (1-0)"],
  [575338, 42, null, 66, "Bruno Fernandes", "Gol de Bruno Fernandes (2-0)"],
  [575338, 45, null, 66, "Benjamin Šeško", "Gol de Benjamin Šeško (3-0)"],
  [575338, 68, null, 66, "Lisandro Martínez", "Sentencia en Old Trafford (4-0)"],

  // 575339: Como 1907 (7397) 4 - 1 RB Leipzig (721)
  [575339, 15, null, 7397, "Martin Baturina", "Gol de Como 1907 (1-0)"],
  [575339, 38, null, 7397, "Anastasios Douvikas", "Gol de Como 1907 (2-0)"],
  [575339, 54, null, 7397, "Assane Diao", "Gol de Como 1907 (3-0)"],
  [575339, 58, null, 721, "Andrija Maksimović", "Descuento de RB Leipzig (3-1)"],
  [575339, 90, null, 7397, "Máximo Perrone", "Sentencia de Como 1907 (4-1)"],

  // 575340: Slavia Praha (930) 2 - 3 RC Lens (546)
  [575340, 51, null, 930, "Danijel Šturm", "Gol de Slavia Praha (1-0)"],
  [575340, 73, null, 546, "Abdallah Sima", "Empate de RC Lens (1-1)"],
  [575340, 88, null, 930, "Danijel Šturm", "Doblete de Šturm (2-1)"],
  [575340, 90, 1, 546, "Florian Thauvin", "Empate agónico de Lens (2-2)"],
  [575340, 90, 3, 546, "Ruben Aguilar", "Remontada de RC Lens (2-3)"],

  // =========================================================================
  // JORNADA 2 (13 y 14 de octubre de 2026)
  // =========================================================================
  // 575341: RC Lens (546) 0 - 2 Sporting CP (498)
  [575341, 22, null, 498, "Luis Suárez", "Gol de Sporting CP (0-1)"],
  [575341, 74, null, 498, "Issa Doumbia", "Sentencia de Sporting CP (0-2)"],

  // 575342: Sabah FK (10233) 2 - 0 Slavia Praha (930)
  [575342, 49, null, 10233, "Kaheem Parris", "Gol de Sabah FK (1-0)"],
  [575342, 88, null, 10233, "Joy-Lance Mickels", "Sentencia en Bakú (2-0)"],

  // 575343: Inter (108) 3 - 4 Club Brugge (851)
  [575343, 30, null, 851, "Nicolò Tresoldi", "Gol de penalti (0-1)"],
  [575343, 44, null, 108, "Lautaro Martínez", "Empate de Inter (1-1)"],
  [575343, 63, null, 851, "Nicolò Tresoldi", "Doblete de Tresoldi (1-2)"],
  [575343, 74, null, 851, "Nicolò Tresoldi", "Hat-trick de Tresoldi (1-3)"],
  [575343, 81, null, 108, "Lautaro Martínez", "Doblete de Lautaro (2-3)"],
  [575343, 87, null, 851, "Romeo Vermant", "Gol de Club Brugge (2-4)"],
  [575343, 90, 3, 108, "Ange-Yoan Bonny", "Descuento en San Siro (3-4)"],

  // 575344: Galatasaray (610) 1 - 4 Barça (81)
  [575344, 27, null, 610, "Aleksey Batrakov", "Gol de Galatasaray (1-0)"],
  [575344, 42, null, 81, "João Cancelo", "Empate de FC Barcelona (1-1)"],
  [575344, 50, null, 81, "Fermín López", "Remontada azulgrana (1-2)"],
  [575344, 53, null, 81, "Anthony Gordon", "Gol de FC Barcelona (1-3)"],
  [575344, 64, null, 81, "Karim Adeyemi", "Sentencia en Estambul (1-4)"],

  // 575345: Atleti (78) 2 - 0 Man United (66)
  [575345, 1, null, 78, "Pablo Barrios", "Gol tempranero colchonero (1-0)"],
  [575345, 79, null, 78, "Ademola Lookman", "Sentencia en el Metropolitano (2-0)"],

  // 575346: Arsenal (57) 3 - 0 Lille (521)
  [575346, 64, null, 57, "Jurriën Timber", "Cabezazo de Arsenal (1-0)"],
  [575346, 67, null, 57, "Eberechi Eze", "Gol de Eberechi Eze (2-0)"],
  [575346, 71, null, 57, "Bukayo Saka", "Sentencia en el Emirates (3-0)"],

  // 575347: Viking (5720) 3 - 3 Bayern (5)
  [575347, 2, null, 5720, "Gianni Stensness", "Gol de Viking (1-0)"],
  [575347, 38, null, 5720, "Peter Christiansen", "Segundo de Viking (2-0)"],
  [575347, 54, null, 5, "Harry Kane", "Descuento de penalti (2-1)"],
  [575347, 60, null, 5, "Harry Kane", "Doblete de Harry Kane (2-2)"],
  [575347, 71, null, 5, "Luis Díaz", "Remontada de Bayern (2-3)"],
  [575347, 90, null, 5720, "Herman Johan Haugen", "Empate final de Viking (3-3)"],

  // 575348: RB Leipzig (721) 1 - 0 PSV (674)
  [575348, 75, null, 721, "Brajan Gruda", "Gol del triunfo de Leipzig (1-0)"],

  // 575349: Villarreal (94) 3 - 1 Napoli (113)
  [575349, 8, null, 113, "Amir Rrahmani", "Gol de Napoli (0-1)"],
  [575349, 23, null, 94, "Georges Mikautadze", "Empate de Villarreal (1-1)"],
  [575349, 26, null, 94, "Santiago Mouriño", "Remontada amarilla (2-1)"],
  [575349, 86, null, 94, "Tani Oluwaseyi", "Sentencia en La Cerámica (3-1)"],

  // 575350: LASK (2016) 3 - 6 Liverpool (64)
  [575350, 22, null, 64, "Ronald Araújo", "Gol de Liverpool (0-1)"],
  [575350, 24, null, 64, "Bradley Barcola", "Gol de Liverpool (0-2)"],
  [575350, 37, null, 64, "Bradley Barcola", "Doblete de Barcola (0-3)"],
  [575350, 51, null, 64, "Jeremie Frimpong", "Gol de Jeremie Frimpong (0-4)"],
  [575350, 63, null, 2016, "Robert Ljubičić", "Descuento de LASK (1-4)"],
  [575350, 66, null, 64, "Bradley Barcola", "Hat-trick de Barcola (1-5)"],
  [575350, 72, null, 64, "Lewis Koumas", "Sexto de Liverpool (1-6)"],
  [575350, 74, null, 2016, "Florian Flecker", "Gol de LASK (2-6)"],
  [575350, 77, null, 2016, "Florian Flecker", "Doblete de Flecker (3-6)"],

  // 575351: Feyenoord (675) 3 - 2 Como 1907 (7397)
  [575351, 18, null, 7397, "Assane Diao", "Gol de Como 1907 (0-1)"],
  [575351, 20, null, 675, "Gjivai Zechiël", "Empate de Feyenoord (1-1)"],
  [575351, 52, null, 675, "Anis Hadj Moussa", "Remontada en De Kuip (2-1)"],
  [575351, 81, null, 675, "Robert Sánchez (p.p.)", "Gol en propia puerta (3-1)"],
  [575351, 90, 3, 7397, "Anastasios Douvikas", "Descuento de Como 1907 (3-2)"],

  // 575352: Roma (100) 3 - 4 Real Madrid (86)
  [575352, 20, null, 100, "Marten de Roon", "Gol de AS Roma (1-0)"],
  [575352, 24, null, 86, "Kylian Mbappé", "Empate de Kylian Mbappé (1-1)"],
  [575352, 50, null, 100, "Donyell Malen", "Ventaja de AS Roma (2-1)"],
  [575352, 68, null, 100, "Niccolò Pisilli", "Tercero de AS Roma (3-1)"],
  [575352, 82, null, 86, "Carlos Espí", "Descuento madridista (3-2)"],
  [575352, 84, null, 86, "Endrick", "Empate de Real Madrid (3-3)"],
  [575352, 89, null, 86, "Antonio Rüdiger", "Cabezazo épico en el Olímpico (3-4)"],

  // 575353: Man City (65) 2 - 4 PSG (524)
  [575353, 13, null, 524, "Désiré Doué", "Gol de PSG (0-1)"],
  [575353, 15, null, 524, "Ousmane Dembélé", "Segundo de PSG (0-2)"],
  [575353, 32, null, 524, "Vitinha", "Disparo de Vitinha (0-3)"],
  [575353, 53, null, 65, "Erling Haaland", "Descuento de Haaland (1-3)"],
  [575353, 62, null, 524, "Maghnes Akliouche", "Cuarto de PSG (1-4)"],
  [575353, 75, null, 65, "Erling Haaland", "Doblete de Haaland (2-4)"],

  // 575354: Bodø/Glimt (5721) 1 - 0 Dortmund (4)
  [575354, 25, null, 5721, "Fredrik Sjøvold", "Gol del triunfo noruego (1-0)"],

  // 575355: Aston Villa (58) 6 - 0 Fenerbahçe (613)
  [575355, 12, null, 58, "Johan Manzambi", "Gol de Aston Villa (1-0)"],
  [575355, 30, null, 58, "Nicolas Jackson", "Gol de Nicolas Jackson (2-0)"],
  [575355, 38, null, 58, "Nicolas Jackson", "Doblete de Jackson (3-0)"],
  [575355, 57, null, 58, "Ross Barkley", "Gol de penalti (4-0)"],
  [575355, 72, null, 58, "Ross Barkley", "Doblete de Barkley (5-0)"],
  [575355, 78, null, 58, "Tammy Abraham", "Sexto en Villa Park (6-0)"],

  // 575356: Real Betis (90) 3 - 2 Porto (503)
  [575356, 47, null, 90, "Abde Ezzalzouli", "Gol de Real Betis (1-0)"],
  [575356, 54, null, 503, "Gabri Veiga", "Empate de FC Porto (1-1)"],
  [575356, 61, null, 503, "Samu Aghehowa", "Ventaja de FC Porto (1-2)"],
  [575356, 74, null, 90, "Cucho Hernández", "Empate de Real Betis (2-2)"],
  [575356, 84, null, 90, "Isco", "Gol de penalti para la remontada (3-2)"],

  // 575357: Shakhtar (1887) 3 - 1 PAE AEK (1899)
  [575357, 28, null, 1899, "Lovro Majer", "Gol de AEK Athens (0-1)"],
  [575357, 34, null, 1887, "Pedrinho", "Empate de penalti (1-1)"],
  [575357, 80, null, 1887, "Vinícius Tobias", "Remontada de Shakhtar (2-1)"],
  [575357, 86, null, 1887, "Gleiker Mendoza", "Sentencia de Shakhtar (3-1)"],

  // 575358: Slovan Bratislava (7509) 0 - 3 Stuttgart (10)
  [575358, 29, null, 10, "Deniz Undav", "Gol de VfB Stuttgart (0-1)"],
  [575358, 64, null, 10, "Sandro Cruz (p.p.)", "Gol en propia puerta (0-2)"],
  [575358, 90, null, 10, "Ermedin Demirović", "Sentencia alemana (0-3)"],

  // =========================================================================
  // JORNADA 3 (20 y 21 de octubre de 2026)
  // =========================================================================
  // 575359: Sabah FK (10233) 1 - 2 Dortmund (4)
  [575359, 10, null, 4, "Serhou Guirassy", "Gol de Borussia Dortmund (0-1)"],
  [575359, 39, null, 10233, "Aden McCarthy", "Empate de Sabah FK (1-1)"],
  [575359, 53, null, 4, "Serhou Guirassy", "Doblete de Guirassy (1-2)"],

  // 575360: Fenerbahçe (613) 2 - 2 Slavia Praha (930)
  [575360, 4, null, 613, "Oğuz Aydın", "Gol de Fenerbahçe (1-0)"],
  [575360, 11, null, 613, "Mason Greenwood", "Segundo de Fenerbahçe (2-0)"],
  [575360, 15, null, 930, "Lukáš Provod", "Descuento de Slavia Praha (2-1)"],
  [575360, 90, null, 930, "Pavel Kačor", "Empate al 90' de Slavia Praha (2-2)"],

  // 575361: Man City (65) 5 - 1 PAE AEK (1899)
  [575361, 12, null, 65, "Elliot Anderson", "Gol de Manchester City (1-0)"],
  [575361, 34, null, 65, "Phil Foden", "Gol de Phil Foden (2-0)"],
  [575361, 52, null, 1899, "Stavros Pilios", "Descuento de AEK Athens (2-1)"],
  [575361, 57, null, 65, "Rayan Cherki", "Gol de Rayan Cherki (3-1)"],
  [575361, 65, null, 65, "Phil Foden", "Doblete de Phil Foden (4-1)"],
  [575361, 76, null, 65, "Phil Foden", "Hat-trick de Phil Foden (5-1)"],

  // 575362: Stuttgart (10) 1 - 1 Atleti (78)
  [575362, 36, null, 10, "Jamie Leweling", "Gol de VfB Stuttgart (1-0)"],
  [575362, 47, null, 78, "Julián Álvarez", "Empate de Julián Álvarez (1-1)"],

  // 575363: Liverpool (64) 4 - 3 Villarreal (94)
  [575363, 4, null, 94, "Georges Mikautadze", "Gol inicial de Villarreal (0-1)"],
  [575363, 29, null, 94, "Sergi Cardona", "Segundo de Villarreal (0-2)"],
  [575363, 36, null, 64, "Alexis Mac Allister", "Descuento de Liverpool (1-2)"],
  [575363, 45, 1, 64, "Ronald Araújo", "Empate antes del descanso (2-2)"],
  [575363, 65, null, 64, "Alexis Mac Allister", "Doblete de Mac Allister (3-2)"],
  [575363, 68, null, 64, "Florian Wirtz", "Cuarto de Liverpool (4-2)"],
  [575363, 87, null, 94, "Tani Oluwaseyi", "Descuento de Villarreal (4-3)"],

  // 575364: Roma (100) 4 - 0 Slovan Bratislava (7509)
  [575364, 21, null, 100, "Mario Hermoso", "Cabezazo de Mario Hermoso (1-0)"],
  [575364, 39, null, 100, "Nahuel Molina", "Gol de Nahuel Molina (2-0)"],
  [575364, 52, null, 100, "Niccolò Pisilli", "Tercero de AS Roma (3-0)"],
  [575364, 58, null, 100, "Donyell Malen", "Gol de penalti (4-0)"],

  // 575365: Porto (503) 0 - 1 PSV (674)
  [575365, 57, null, 674, "Guus Til", "Gol de la victoria de PSV (0-1)"],

  // 575366: Napoli (113) 4 - 3 Bodø/Glimt (5721)
  [575366, 1, null, 113, "Matteo Politano", "Gol al minuto 1 de Napoli (1-0)"],
  [575366, 27, null, 5721, "Jens Petter Hauge", "Empate de Bodø/Glimt (1-1)"],
  [575366, 41, null, 113, "Scott McTominay", "Ventaja de Napoli (2-1)"],
  [575366, 62, null, 5721, "Andreas Helmersen", "Nuevo empate noruego (2-2)"],
  [575366, 75, null, 113, "Scott McTominay", "Doblete de McTominay (3-2)"],
  [575366, 88, null, 113, "Odin Bjørtuft (p.p.)", "Gol en propia puerta (4-2)"],
  [575366, 90, 4, 5721, "Sondre Brunstad Fet", "Descuento en el añadido (4-3)"],

  // 575367: PSG (524) 4 - 2 Barça (81)
  [575367, 38, null, 524, "Désiré Doué", "Gol de Désiré Doué (1-0)"],
  [575367, 55, null, 81, "Xavi Espart", "Empate de Xavi Espart (1-1)"],
  [575367, 72, null, 524, "Lucas Hernández", "Cabezazo de Lucas Hernández (2-1)"],
  [575367, 79, null, 81, "Lamine Yamal", "Golazo de Lamine Yamal (2-2)"],
  [575367, 81, null, 524, "Vitinha", "Remate de Vitinha (3-2)"],
  [575367, 86, null, 524, "Fabián Ruiz", "Sentencia de Fabián Ruiz (4-2)"],

  // 575368: Como 1907 (7397) 4 - 1 Man United (66)
  [575368, 3, null, 7397, "Nico Paz", "Gol tempranero de Nico Paz (1-0)"],
  [575368, 49, null, 7397, "Anastasios Douvikas", "Segundo de Como 1907 (2-0)"],
  [575368, 57, null, 7397, "Nico Paz", "Doblete de Nico Paz (3-0)"],
  [575368, 76, null, 7397, "Jacobo Ramón", "Cuarto de Como 1907 (4-0)"],
  [575368, 90, 1, 66, "Joshua Zirkzee", "Descuento de Man United (4-1)"],

  // 575369: Lille (521) 2 - 4 Galatasaray (610)
  [575369, 2, null, 610, "Yunus Akgün", "Gol inicial de Galatasaray (0-1)"],
  [575369, 7, null, 521, "Soriba Diaoune", "Empate de Lille (1-1)"],
  [575369, 39, null, 521, "Soriba Diaoune", "Doblete de Diaoune (2-1)"],
  [575369, 44, null, 610, "Aleksey Batrakov", "Empate de Galatasaray (2-2)"],
  [575369, 52, null, 610, "Berke Özer (p.p.)", "Gol en propia puerta (2-3)"],
  [575369, 61, null, 610, "Victor Osimhen", "Sentencia de Victor Osimhen (2-4)"],

  // 575370: Real Madrid (86) 4 - 1 RB Leipzig (721)
  [575370, 43, null, 86, "Bernardo Silva", "Gol de Bernardo Silva (1-0)"],
  [575370, 52, null, 86, "Arda Güler", "Zurda de Arda Güler (2-0)"],
  [575370, 83, null, 86, "Kylian Mbappé", "Definición de Kylian Mbappé (3-0)"],
  [575370, 85, null, 721, "Tidiam Gomis", "Descuento de RB Leipzig (3-1)"],
  [575370, 87, null, 86, "Yan Diomande", "Sentencia en el Bernabéu (4-1)"],

  // 575371: Inter (108) 1 - 0 Shakhtar (1887)
  [575371, 77, null, 108, "Carlos Augusto", "Gol de la victoria de Inter (1-0)"],

  // 575372: Bayern (5) 2 - 2 Arsenal (57)
  [575372, 25, null, 57, "Eberechi Eze", "Gol de Eberechi Eze (0-1)"],
  [575372, 34, null, 5, "Alphonso Davies", "Empate de Alphonso Davies (1-1)"],
  [575372, 61, null, 5, "Harry Kane", "Gol de penalti de Harry Kane (2-1)"],
  [575372, 82, null, 57, "Declan Rice", "Empate de Declan Rice (2-2)"],

  // 575373: Club Brugge (851) 3 - 0 RC Lens (546)
  [575373, 45, 3, 851, "Hans Vanaken", "Gol de Hans Vanaken (1-0)"],
  [575373, 50, null, 851, "Joaquin Seys", "Gol de Joaquin Seys (2-0)"],
  [575373, 72, null, 851, "Carlos Forbs", "Sentencia de Club Brugge (3-0)"],

  // 575374: Aston Villa (58) 3 - 1 Viking (5720)
  [575374, 23, null, 58, "Ross Barkley", "Gol de Ross Barkley (1-0)"],
  [575374, 37, null, 58, "Emiliano Buendía", "Gol de penalti (2-0)"],
  [575374, 62, null, 58, "Henrik Heggheim (p.p.)", "Gol en propia puerta (3-0)"],
  [575374, 86, null, 5720, "Peter Christiansen", "Descuento de Viking (3-1)"],

  // 575375: Sporting CP (498) 2 - 3 LASK (2016)
  [575375, 14, null, 498, "Luis Suárez", "Gol de penalti de Luis Suárez (1-0)"],
  [575375, 31, null, 2016, "Christoph Lang", "Empate de LASK (1-1)"],
  [575375, 58, null, 2016, "Saša Kalajdžić", "Remontada de LASK (1-2)"],
  [575375, 74, null, 2016, "Kryštof Daněk", "Tercero de LASK (1-3)"],
  [575375, 89, null, 498, "Luis Suárez", "Doblete de Luis Suárez (2-3)"],

  // 575376: Real Betis (90) 1 - 0 Feyenoord (675)
  [575376, 59, null, 90, "Isco", "Gol de penalti de Isco (1-0)"],
];

export const STITCH_REFERENCE_EVENTS: MatchEventRow[] = RAW_OFFICIAL_GOALS.map(
  ([matchId, minute, extraMinute, teamId, playerName, detail], idx) => ({
    id: `11111111-2026-4000-8000-${String(idx + 1).padStart(12, "0")}`,
    match_id: matchId,
    minute,
    extra_minute: extraMinute,
    team_id: teamId,
    player_name: playerName,
    assist_or_sub_name: null,
    event_type: "GOAL",
    detail,
    created_at: "2026-10-21T21:45:00Z",
  })
);

/**
 * Datos de referencia sincronizados con el calendario oficial 2026/27 de la UEFA Champions League
 * (Jornada 4: martes 3 y miércoles 4 de noviembre de 2026, y Jornada 3 finalizada el 20 y 21 de octubre).
 */
export const STITCH_REFERENCE_MATCHES: MatchWithDetails[] = [
  {
    id: 575380,
    season: 2026,
    stage: "LEAGUE_STAGE",
    matchday: 4,
    bracket_slot: null,
    leg: null,
    kickoff_at: "2026-11-03T20:00:00Z",
    status: "SCHEDULED",
    elapsed_minute: null,
    extra_minute: null,
    home_team_id: 81,
    home_team_name: "FC Barcelona",
    home_team_crest: "https://crests.football-data.org/81.png",
    away_team_id: 58,
    away_team_name: "Aston Villa",
    away_team_crest: "https://crests.football-data.org/58.png",
    home_score: 0,
    away_score: 0,
    aggregate_home_score: null,
    aggregate_away_score: null,
    penalty_home_score: null,
    penalty_away_score: null,
    live_stats: {
      home_rank_label: "6° Lugar • 6 pts (+4)",
      away_rank_label: "5° Lugar • 7 pts (+5)",
      half_label: "Jornada 4",
      is_spotlight: true,
    },
    venue: "Estadi Olímpic Lluís Companys, Barcelona",
    referee: "Designación Oficial UEFA",
    updated_at: "2026-10-23T20:00:00Z",
    prediction: {
      match_id: 575380,
      home_win_prob: 52,
      draw_prob: 24,
      away_win_prob: 24,
      predicted_home_goals: 2,
      predicted_away_goals: 1,
      recent_form_score: { weight: 30, note: "Racha Fase de Liga 2026" },
      stats_xg_score: { weight: 30, note: "Peligro ofensivo / concedido" },
      hierarchy_score: { weight: 25, note: "Coeficiente UEFA 5 años" },
      h2h_score: { weight: 15, note: "Factor localía Montjuïc" },
      explanation_summary:
        "Ventaja FC Barcelona (52%) • Modelo Poisson para la Jornada 4 (martes 3 de noviembre).",
      updated_at: "2026-10-23T20:00:00Z",
    },
    events: [],
  },
  {
    id: 575381,
    season: 2026,
    stage: "LEAGUE_STAGE",
    matchday: 4,
    bracket_slot: null,
    leg: null,
    kickoff_at: "2026-11-03T20:00:00Z",
    status: "SCHEDULED",
    elapsed_minute: null,
    extra_minute: null,
    home_team_id: 78,
    home_team_name: "Atlético de Madrid",
    home_team_crest: "https://crests.football-data.org/78.png",
    away_team_id: 5,
    away_team_name: "Bayern München",
    away_team_crest: "https://crests.football-data.org/5.png",
    home_score: 0,
    away_score: 0,
    aggregate_home_score: null,
    aggregate_away_score: null,
    penalty_home_score: null,
    penalty_away_score: null,
    live_stats: {
      home_rank_label: "Fase de Liga UCL",
      away_rank_label: "2° Lugar • 7 pts (+7)",
      half_label: "Jornada 4",
    },
    venue: "Riyadh Air Metropolitano, Madrid",
    referee: "Designación Oficial UEFA",
    updated_at: "2026-10-23T20:00:00Z",
    prediction: {
      match_id: 575381,
      home_win_prob: 36,
      draw_prob: 26,
      away_win_prob: 38,
      predicted_home_goals: 1,
      predicted_away_goals: 2,
      recent_form_score: null,
      stats_xg_score: null,
      hierarchy_score: null,
      h2h_score: null,
      explanation_summary:
        "Duelo equilibrado (36% vs 38%) • Jornada 4 (martes 3 de noviembre).",
      updated_at: "2026-10-23T20:00:00Z",
    },
    events: [],
  },
  {
    id: 575382,
    season: 2026,
    stage: "LEAGUE_STAGE",
    matchday: 4,
    bracket_slot: null,
    leg: null,
    kickoff_at: "2026-11-03T20:00:00Z",
    status: "SCHEDULED",
    elapsed_minute: null,
    extra_minute: null,
    home_team_id: 94,
    home_team_name: "Villarreal CF",
    home_team_crest: "https://crests.football-data.org/94.png",
    away_team_id: 524,
    away_team_name: "Paris Saint-Germain",
    away_team_crest: "https://crests.football-data.org/524.png",
    home_score: 0,
    away_score: 0,
    aggregate_home_score: null,
    aggregate_away_score: null,
    penalty_home_score: null,
    penalty_away_score: null,
    live_stats: {
      home_rank_label: "Fase de Liga UCL",
      away_rank_label: "1° Lugar • 9 pts (+9)",
      half_label: "Jornada 4",
    },
    venue: "Estadio de la Cerámica",
    referee: "Designación Oficial UEFA",
    updated_at: "2026-10-23T20:00:00Z",
    prediction: {
      match_id: 575382,
      home_win_prob: 29,
      draw_prob: 24,
      away_win_prob: 47,
      predicted_home_goals: 1,
      predicted_away_goals: 2,
      recent_form_score: null,
      stats_xg_score: null,
      hierarchy_score: null,
      h2h_score: null,
      explanation_summary: "Ventaja PSG (47%) • Jornada 4 (martes 3 de noviembre).",
      updated_at: "2026-10-23T20:00:00Z",
    },
    events: [],
  },
  {
    id: 575386,
    season: 2026,
    stage: "LEAGUE_STAGE",
    matchday: 4,
    bracket_slot: null,
    leg: null,
    kickoff_at: "2026-11-04T17:45:00Z",
    status: "SCHEDULED",
    elapsed_minute: null,
    extra_minute: null,
    home_team_id: 611,
    home_team_name: "PAE AEK",
    home_team_crest: "https://crests.football-data.org/611.png",
    away_team_id: 86,
    away_team_name: "Real Madrid",
    away_team_crest: "https://crests.football-data.org/86.png",
    home_score: 0,
    away_score: 0,
    aggregate_home_score: null,
    aggregate_away_score: null,
    penalty_home_score: null,
    penalty_away_score: null,
    live_stats: {
      home_rank_label: "Fase de Liga UCL",
      away_rank_label: "4° Lugar • 7 pts (+6)",
      half_label: "Jornada 4",
    },
    venue: "OPAP Arena, Atenas",
    referee: "Designación Oficial UEFA",
    updated_at: "2026-10-23T20:00:00Z",
    prediction: {
      match_id: 575386,
      home_win_prob: 18,
      draw_prob: 22,
      away_win_prob: 60,
      predicted_home_goals: 1,
      predicted_away_goals: 3,
      recent_form_score: null,
      stats_xg_score: null,
      hierarchy_score: null,
      h2h_score: null,
      explanation_summary:
        "Ventaja Real Madrid (60%) • Jornada 4 (miércoles 4 de noviembre).",
      updated_at: "2026-10-23T20:00:00Z",
    },
    events: [],
  },
  {
    id: 575388,
    season: 2026,
    stage: "LEAGUE_STAGE",
    matchday: 4,
    bracket_slot: null,
    leg: null,
    kickoff_at: "2026-11-04T20:00:00Z",
    status: "SCHEDULED",
    elapsed_minute: null,
    extra_minute: null,
    home_team_id: 721,
    home_team_name: "RB Leipzig",
    home_team_crest: "https://crests.football-data.org/721.png",
    away_team_id: 65,
    away_team_name: "Manchester City",
    away_team_crest: "https://crests.football-data.org/65.png",
    home_score: 0,
    away_score: 0,
    aggregate_home_score: null,
    aggregate_away_score: null,
    penalty_home_score: null,
    penalty_away_score: null,
    live_stats: {
      home_rank_label: "Fase de Liga UCL",
      away_rank_label: "Top 8 UCL",
      half_label: "Jornada 4",
    },
    venue: "Red Bull Arena, Leipzig",
    referee: "Designación Oficial UEFA",
    updated_at: "2026-10-23T20:00:00Z",
    prediction: {
      match_id: 575388,
      home_win_prob: 28,
      draw_prob: 24,
      away_win_prob: 48,
      predicted_home_goals: 1,
      predicted_away_goals: 2,
      recent_form_score: null,
      stats_xg_score: null,
      hierarchy_score: null,
      h2h_score: null,
      explanation_summary:
        "Ventaja Manchester City (48%) • Jornada 4 (miércoles 4 de noviembre).",
      updated_at: "2026-10-23T20:00:00Z",
    },
    events: [],
  },
  {
    id: 575367,
    season: 2026,
    stage: "LEAGUE_STAGE",
    matchday: 3,
    bracket_slot: null,
    leg: null,
    kickoff_at: "2026-10-20T19:00:00Z",
    status: "FINISHED",
    elapsed_minute: null,
    extra_minute: null,
    home_team_id: 524,
    home_team_name: "Paris Saint-Germain",
    home_team_crest: "https://crests.football-data.org/524.png",
    away_team_id: 81,
    away_team_name: "FC Barcelona",
    away_team_crest: "https://crests.football-data.org/81.png",
    home_score: 4,
    away_score: 2,
    aggregate_home_score: null,
    aggregate_away_score: null,
    penalty_home_score: null,
    penalty_away_score: null,
    live_stats: {
      home_possession: 47,
      away_possession: 53,
      home_rank_label: "1° Lugar • 9 pts (+9)",
      away_rank_label: "6° Lugar • 6 pts (+4)",
      half_label: "Tiempo Completo",
      is_spotlight: true,
    },
    venue: "Parc des Princes, París",
    referee: "Michael Oliver (ENG)",
    updated_at: "2026-10-21T22:00:00Z",
    prediction: null,
    events: STITCH_REFERENCE_EVENTS.filter((e) => e.match_id === 575367),
  },
  {
    id: 575370,
    season: 2026,
    stage: "LEAGUE_STAGE",
    matchday: 3,
    bracket_slot: null,
    leg: null,
    kickoff_at: "2026-10-21T19:00:00Z",
    status: "FINISHED",
    elapsed_minute: null,
    extra_minute: null,
    home_team_id: 86,
    home_team_name: "Real Madrid",
    home_team_crest: "https://crests.football-data.org/86.png",
    away_team_id: 721,
    away_team_name: "RB Leipzig",
    away_team_crest: "https://crests.football-data.org/721.png",
    home_score: 4,
    away_score: 1,
    aggregate_home_score: null,
    aggregate_away_score: null,
    penalty_home_score: null,
    penalty_away_score: null,
    live_stats: {
      home_possession: 64,
      away_possession: 36,
      home_rank_label: "4° Lugar • 7 pts (+6)",
      away_rank_label: "Fase de Liga UCL",
      half_label: "Tiempo Completo",
    },
    venue: "Estadio Santiago Bernabéu, Madrid",
    referee: "Designación Oficial UEFA",
    updated_at: "2026-10-21T22:00:00Z",
    prediction: null,
    events: STITCH_REFERENCE_EVENTS.filter((e) => e.match_id === 575370),
  },
  {
    id: 575372,
    season: 2026,
    stage: "LEAGUE_STAGE",
    matchday: 3,
    bracket_slot: null,
    leg: null,
    kickoff_at: "2026-10-21T19:00:00Z",
    status: "FINISHED",
    elapsed_minute: null,
    extra_minute: null,
    home_team_id: 5,
    home_team_name: "Bayern München",
    home_team_crest: "https://crests.football-data.org/5.png",
    away_team_id: 57,
    away_team_name: "Arsenal FC",
    away_team_crest: "https://crests.football-data.org/57.png",
    home_score: 2,
    away_score: 2,
    aggregate_home_score: null,
    aggregate_away_score: null,
    penalty_home_score: null,
    penalty_away_score: null,
    live_stats: {
      home_possession: 43,
      away_possession: 57,
      home_rank_label: "2° Lugar • 7 pts (+7)",
      away_rank_label: "Top 8 UCL",
      half_label: "Tiempo Completo",
    },
    venue: "Allianz Arena, Múnich",
    referee: "Designación Oficial UEFA",
    updated_at: "2026-10-21T22:00:00Z",
    prediction: null,
    events: STITCH_REFERENCE_EVENTS.filter((e) => e.match_id === 575372),
  },
  {
    id: 575363,
    season: 2026,
    stage: "LEAGUE_STAGE",
    matchday: 3,
    bracket_slot: null,
    leg: null,
    kickoff_at: "2026-10-20T19:00:00Z",
    status: "FINISHED",
    elapsed_minute: null,
    extra_minute: null,
    home_team_id: 64,
    home_team_name: "Liverpool FC",
    home_team_crest: "https://crests.football-data.org/64.png",
    away_team_id: 94,
    away_team_name: "Villarreal CF",
    away_team_crest: "https://crests.football-data.org/94.png",
    home_score: 4,
    away_score: 3,
    aggregate_home_score: null,
    aggregate_away_score: null,
    penalty_home_score: null,
    penalty_away_score: null,
    live_stats: {
      home_possession: 54,
      away_possession: 46,
      home_rank_label: "Top 8 UCL",
      away_rank_label: "Fase de Liga UCL",
      half_label: "Tiempo Completo",
    },
    venue: "Anfield, Liverpool",
    referee: "Designación Oficial UEFA",
    updated_at: "2026-10-21T22:00:00Z",
    prediction: null,
    events: STITCH_REFERENCE_EVENTS.filter((e) => e.match_id === 575363),
  },
  {
    id: 575361,
    season: 2026,
    stage: "LEAGUE_STAGE",
    matchday: 3,
    bracket_slot: null,
    leg: null,
    kickoff_at: "2026-10-20T19:00:00Z",
    status: "FINISHED",
    elapsed_minute: null,
    extra_minute: null,
    home_team_id: 65,
    home_team_name: "Manchester City",
    home_team_crest: "https://crests.football-data.org/65.png",
    away_team_id: 1899,
    away_team_name: "PAE AEK",
    away_team_crest: "https://crests.football-data.org/611.png",
    home_score: 5,
    away_score: 1,
    aggregate_home_score: null,
    aggregate_away_score: null,
    penalty_home_score: null,
    penalty_away_score: null,
    live_stats: {
      home_possession: 64,
      away_possession: 36,
      home_rank_label: "3° Lugar • 7 pts (+7)",
      away_rank_label: "Fase de Liga UCL",
      half_label: "Tiempo Completo",
    },
    venue: "Etihad Stadium, Mánchester",
    referee: "Designación Oficial UEFA",
    updated_at: "2026-10-21T22:00:00Z",
    prediction: null,
    events: STITCH_REFERENCE_EVENTS.filter((e) => e.match_id === 575361),
  },
];
