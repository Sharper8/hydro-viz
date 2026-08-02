Conception et déploiement d'une 
plateforme web interactive pour la 
délimitation et la simulation des bassins 
hydrographiques 
1. L'évolution vers l'hydro-informatique web-native et 
la décentralisation des traitements 
La modélisation, la délimitation et la simulation des bassins hydrographiques constituent la 
pierre angulaire de nombreuses disciplines environnementales et de l'aménagement du 
territoire, de l'évaluation des risques d'inondation à la planification de la restauration écologique. 
Historiquement, l'extraction des réseaux de drainage et la définition des lignes de partage des 
eaux nécessitaient l'utilisation de Systèmes d'Information Géographique (SIG) lourds 
d'architecture bureautique, tels que QGIS ou ArcGIS. Ces outils requièrent le téléchargement 
local de vastes volumes de données, tels que des Modèles Numériques de Terrain (MNT) 
pesant plusieurs gigaoctets, ainsi que des couches vectorielles complexes, avant de soumettre 
la machine locale à des calculs géométriques et matriciels intenses1. Cette approche 
centralisée présente aujourd'hui des limites intrinsèques majeures : une faible interopérabilité, 
une difficulté systémique à partager interactivement les résultats de la modélisation avec des 
décideurs ou le grand public, et une contrainte matérielle forte limitant l'échelle des analyses2. 
Le paradigme technologique contemporain s'oriente résolument vers des architectures 
web-natives et cloud-natives. L'objectif est de s'affranchir totalement des logiciels SIG de 
bureau en déportant la logique algorithmique et le rendu visuel directement dans le navigateur 
de l'utilisateur final (via WebAssembly et WebGPU) ou par l'entremise d'architectures sans 
serveur (serverless) capables de traiter des requêtes à la volée5. Le présent rapport d'expertise 
propose une analyse exhaustive des méthodes, des référentiels de données et des 
infrastructures technologiques permettant de concevoir une cartographie web interactive 
capable de générer, simuler et visualiser la délimitation des bassins versants de manière 
réaliste à toutes les échelles, du grand réseau fluvial à l'impluvium extrêmement localisé. 
2. Le socle sémantique et géospatial : Référentiels 
hydrographiques multi-échelles 
Une plateforme web dédiée à la délimitation de bassins versants ne peut se fonder uniquement 
sur l'analyse altimétrique brute ; elle exige l'hybridation avec des référentiels vectoriels 
institutionnels décrivant la topologie validée du réseau hydrographique. Ces données servent à 
forcer et à calibrer les modèles d'écoulement générés numériquement. 

2.1. Structuration nationale : La BD TOPAGE® et le système SANDRE 
Sur le territoire français, le passage d'une modélisation hydrographique à moyenne échelle vers 
une modélisation à grande échelle s'est concrétisé par l'avènement de la BD TOPAGE®7. 
Coproduite par l'Institut national de l'information géographique et forestière (IGN) et l'Office 
français de la biodiversité (OFB), la BD TOPAGE® remplace la base historique BD 
CARTHAGE® afin de fournir un référentiel à précision métrique, exhaustif, et parfaitement 
conforme à la directive européenne INSPIRE ainsi qu'au Référentiel à Grande Échelle 
(RGE®)7. 
Contrairement aux approches purement cartographiques antérieures qui reposaient 
principalement sur la toponymie, la BD TOPAGE® introduit une structuration unitaire cohérente 
avec les principes hydrologiques, visant à représenter parfaitement la continuité physique du 
réseau9. Le référentiel rassemble plusieurs centaines de milliers de kilomètres de réseaux, 
structurés autour de huit jeux de données fondamentaux. Les cours d'eau représentent les 
écoulements naturels ou aménagés11. Les plans d'eau modélisent les entités surfaciques, tandis 
que les surfaces élémentaires permettent d'assurer la continuité logique des écoulements 
virtuels (tronçons fictifs) traversant de larges plans d'eau ou estuaires11. Le squelette 
géométrique est formé par près de 800 000 kilomètres de tronçons hydrographiques continus, 
reliés par des nœuds hydrographiques qui garantissent la topologie du graphe (nœud amont et 
nœud aval), évitant ainsi toute rupture d'écoulement dans la base de données11. Les limites 
terre-eau (ou limites terre-mer) définissent les exutoires finaux, en intégrant notamment les 
limites du Service hydrographique et océanographique de la marine (SHOM)11. Enfin, les 
bassins hydrographiques et les bassins versants topographiques offrent des découpages 
polygonaux validés11. 
L'administration de ce référentiel est régie par le Service d'Administration Nationale des 
Données et des Référentiels sur l'Eau (Sandre), qui impose une codification gigogne stricte 
issue de la circulaire interministérielle n°91-50 du 12 février 199115. Cette codification divise le 
territoire national en quatre partitions hiérarchisées, facilitant l'imbrication des modèles 
hydrologiques de la macro-échelle à la micro-échelle. 
 
Niveau hiérarchique 
SANDRE 
Ordre 
Caractéristiques et Rôle 
dans la modélisation 
hydrologique 
Région hydrographique 
1er ordre 
Division majeure du 
territoire (ex. bassin de la 
Loire). Constituée d'un 
groupement de secteurs. 
L'identifiant national garantit 
l'unicité du grand bassin16. 

Secteur hydrographique 
2ème ordre 
Subdivision de la région. Un 
secteur peut être découpé 
en un maximum de dix 
sous-secteurs, gérés sous 
la responsabilité des 
Agences de l'Eau15. 
Sous-secteur 
hydrographique 
3ème ordre 
Partition intermédiaire 
regroupant des zones 
affluentes. Les bassins 
R.N.D.E. (Réseau National 
des Données sur l'Eau) sont 
des agrégations strictes et 
connexes de ces 
sous-secteurs possédant un 
exutoire maritime ou 
frontalier homogène15. 
Zone hydrographique 
4ème ordre 
Unité élémentaire dont les 
limites s'appuient sur les 
bassins versants 
topographiques. Elle peut 
représenter la source amont 
d'un réseau, un bassin 
intermédiaire traversé par le 
cours d'eau principal, ou le 
bassin aval bordant le 
littoral16. 
La structuration prévoit également la définition de "Bassins DCE", correspondant aux districts 
hydrographiques nationaux ou internationaux nécessaires à l'application de la Directive Cadre 
sur l'Eau, garantissant que toute application web développée sur cette base sémantique soit 
compatible avec les exigences réglementaires européennes20. 
2.2. L'échelle mondiale : HydroSHEDS, HydroBASINS et la 
nomenclature de Pfafstetter 
Pour concevoir une application web dont la portée dépasse les frontières métropolitaines, 
l'intégration d'un référentiel hydrographique mondial est indispensable. La norme académique et 
industrielle actuelle est le projet HydroSHEDS, dont la base de données polygonale vectorielle, 
HydroBASINS, fournit un maillage continu des sous-bassins mondiaux22. 
La structuration d'HydroBASINS repose sur le système de codification topologique de 
Pfafstetter, qui décompose les bassins de manière hiérarchique et systématique sur 12 niveaux 

d'échelle22. Ce système attribue des identifiants numériques reflétant la connectivité amont-aval, 
permettant à un algorithme web de déterminer instantanément par simple analyse syntaxique 
de l'identifiant si un bassin est tributaire d'un autre25. Le niveau 1 ou 3 correspond aux plus 
grands bassins fluviaux continentaux, tandis que le niveau 12 segmente les micro-bassins 
versants23. Le jeu de données dérivé, HydroATLAS, enrichit ces polygones de 281 attributs 
individuels décrivant des variables hydro-environnementales précalculées, facilitant l'affichage 
de statistiques à la volée dans le navigateur27. 
Historiquement, la version 1 d'HydroSHEDS s'appuyait sur la mission SRTM (Shuttle Radar 
Topography Mission), souffrant d'artefacts liés à la végétation et d'une absence totale de 
couverture au-delà du 60ème parallèle nord, obligeant à utiliser les données HYDRO1k 
beaucoup plus grossières pour les régions arctiques23. La version 2 d'HydroSHEDS, prévue 
pour un déploiement progressif jusqu'en 2026 sous licence libre CC-BY 4.0, marque une 
rupture technologique majeure. Elle est dérivée du modèle altimétrique TanDEM-X à 12 mètres 
de résolution, généré par le Centre aérospatial allemand (DLR) et Airbus28. Ce modèle est 
ré-échantillonné et conditionné hydrologiquement pour produire des cartes de directions 
d'écoulement (DIR), d'accumulations (ACC) et des réseaux fluviaux (RIV) à une résolution 
globale sans précédent d'une seconde d'arc, soit approximativement 30 mètres à l'équateur, 
avec une couverture mondiale intégrale29. 
3. L'altimétrie de haute précision : Modélisation 
topographique web-compatible 
La délimitation d'un bassin versant à une échelle "très locale" ne peut se satisfaire des modèles 
mondiaux à 30 mètres de résolution, qui lissent excessivement les éléments de 
micro-topographie tels que les talus, les routes surélevées, ou les fossés de drainage, faussant 
radicalement le calcul des directions d'écoulement urbaines ou périurbaines. La création d'une 
architecture réaliste requiert l'intégration de Modèles Numériques de Terrain (MNT) à très haute 
résolution. 
3.1. RGE ALTI® et la révolution du programme LiDAR HD 
L'Institut national de l'information géographique et forestière met à disposition le produit RGE 
ALTI®, un modèle numérique de terrain maillé distribué historiquement à des pas de 1 et 5 
mètres, conçu pour des échelles d'utilisation comprises entre le 1:3 000 et le 1:20 00030. Il décrit 
la forme de la surface du sol nu, expurgée du sursol, et a été historiquement assemblé à partir 
de données hétérogènes (corrélation d'images aériennes en été, radar en montagne, et LiDAR 
ciblé dans les zones inondables)30. 
Toutefois, la modélisation hydrologique connaît un bouleversement absolu avec le déploiement 
du programme national LiDAR Haute Densité (LiDAR HD), mené entre 2021 et 202633. Soutenu 
par un investissement étatique massif, ce programme ambitionne d'acquérir une couverture 
tridimensionnelle du territoire métropolitain et ultramarin (hors Guyane) avec une densité 
exceptionnellement élevée de 10 impulsions laser par mètre carré34. La classification de ces 

nuages de points massifs permet à l'IGN de dériver et de publier en open data des Modèles 
Numériques de Terrain (sol nu), des Modèles Numériques de Surface (MNS, incluant la 
canopée et les bâtiments), et des Modèles Numériques de Hauteur (MNH)32. 
Les MNT dérivés du LiDAR HD atteignent une résolution native de 50 centimètres, offrant une 
précision altimétrique remarquable de l'ordre de 10 centimètres et une précision planimétrique 
comprise entre 30 et 50 centimètres32. Cette granularité permet aux algorithmes de routage 
hydrographique d'identifier les barrières anthropiques subtiles et les lits mineurs extrêmement 
étroits, augmentant considérablement la fiabilité des bassins versants générés à grande 
échelle. La couverture de la France, qui procède par blocs géographiques (tuiles de 1 km par 1 
km), a déjà rendu accessibles des centaines de milliers de kilomètres carrés, publiés 
progressivement sous forme de matrices au format GeoTIFF (et Cloud Optimized GeoTIFF)36. 
3.2. L'accès dynamique via l'API Géoplateforme 
Afin d'éviter le téléchargement préalable de ces bases de données monolithiques, l'architecture 
d'une plateforme web s'appuie sur la consommation de services REST. La Géoplateforme de 
l'IGN remplace l'ancien Géoportail et expose un écosystème d'API spécifiquement conçu pour 
les applications web spatialisées39. 
Le calcul des élévations peut être délégué à l'API de calcul altimétrique, interrogeable via l'URL 
de base https://data.geopf.fr/altimetrie39. Cette API prend en charge les méthodes HTTP GET et 
POST. La route /1.0/calcul/alti/rest/elevation accepte en entrée des tableaux de longitudes et de 
latitudes (limités à 5 000 coordonnées par requête pour préserver les performances) et retourne 
l'élévation exacte en s'appuyant dynamiquement sur la ressource altimétrique spécifiée (par 
exemple, le RGE ALTI® via l'identifiant de ressource ign_rge_alti_wld)41. Si un point est situé 
hors de la zone de couverture, l'API retourne la valeur conventionnelle de -9999942. 
L'API expose également une route /1.0/calcul/alti/rest/elevationLine dédiée au calcul de profils 
altimétriques le long d'une courbe, intégrant un paramètre profile_mode pouvant être configuré 
sur "accurate" pour doubler le sur-échantillonnage, garantissant ainsi une précision maximale 
lors de la vérification de la pente d'un thalweg41. Bien que cette API soit extrêmement utile pour 
valider l'élévation d'un point exutoire sélectionné par un utilisateur, la délimitation complète d'un 
bassin versant nécessitera la manipulation algorithmique de la tuile MNT dans son intégralité, 
soit via une architecture serveur, soit directement dans le navigateur. 
4. Conditionnement hydrologique et algorithmique de 
routage spatial 
La génération d'un bassin versant à partir d'un MNT brut n'est jamais immédiate. Le modèle 
d'élévation, même issu d'un capteur LiDAR HD, requiert une séquence stricte de 
conditionnement hydrologique (hydro-enforcement) visant à corriger les artefacts numériques et 
à garantir que l'eau simulée s'écoule de manière continue vers les exutoires1. L'exécution de 
cette chaîne algorithmique sur le web constitue le cœur technologique de la plateforme. 
4.1. Le forçage hydrographique (Stream Burning) 

La première étape de conditionnement vise à résoudre le décalage potentiel entre la matrice 
altimétrique et la réalité topologique validée des réseaux hydrographiques44. Sur les MNT bruts, 
les algorithmes ont tendance à générer des écoulements parallèles fictifs ou à subir un 
phénomène de piratage de cours d'eau (stream piracy), où le flux bascule artificiellement dans 
un vallon adjacent à cause du lissage du relief ou de la présence d'un pont bloquant 
numériquement le fond de vallée44. 
La technique du forçage hydrographique, ou "Stream Burning", consiste à utiliser une couche 
vectorielle fiable (telle que la BD TOPAGE® récupérée via le service WFS de la Géoplateforme 
IGN8) pour corriger le MNT. L'approche primaire du stream burning implique la rastérisation du 
réseau vectoriel pour abaisser brutalement l'altitude des cellules du MNT coïncidant avec les 
rivières, creusant de profondes tranchées numériques45. Cependant, cette méthode 
rudimentaire engendre des falaises virtuelles provoquant des anomalies de calcul des pentes 
latérales. 
Des modèles plus avancés ont été développés, à l'instar de l'algorithme AGREE (Hellweger, 
1997) implanté historiquement dans les outils Arc Hydro45. AGREE lisse les cellules adjacentes 
au réseau pour former des berges inclinées en douceur, créant un profil en V ou en U réaliste 
qui préserve la validité des calculs de dénivelé45. Plus récemment, des algorithmes innovants 
comme le TopologicalBreachBurn exploitent la métrique de la Longueur Totale du Canal en 
Amont (TUCL - Total Upstream Channel Length). Cet algorithme élague le réseau vectoriel pour 
correspondre exactement à la résolution du MNT, priorise les flux principaux en cas de 
chevauchement de segments sur un même pixel, et contraint l'incision du MNT à l'intérieur de 
biefs individuels, annihilant ainsi les erreurs topologiques qui faussaient jusqu'alors la définition 
des bassins versants à haute résolution44. Sur une architecture web, cette étape implique de 
fusionner dynamiquement le GeoJSON des rivières et la matrice d'élévation avant d'initier le 
calcul des pentes46. 
4.2. Remplissage des dépressions : La suprématie de l'algorithmique 
Priority-Flood 
Après le forçage des rivières, le MNT présente toujours de multiples cuvettes artificielles (sinks, 
pits). Il s'agit de pixels dont l'élévation est strictement inférieure à celle de tous leurs voisins, 
piégeant l'eau et bloquant la propagation de l'algorithme d'accumulation1. Historiquement, les 
algorithmes de remplissage de type Jenson & Domingue présentaient une complexité 
temporelle inefficace en 
 ou 
, rendant impossible le traitement de matrices 
de grande taille51. 
Le standard de l'état de l'art, indispensable pour garantir la fluidité des calculs sur le web, 
repose sur l'algorithme Priority-Flood, originellement introduit par Ehlschlaeger en 1989 et 
popularisé par Wang & Liu en 200651. Cet algorithme adopte une stratégie de recherche 
"best-first" simulant une montée des eaux depuis les bords du domaine spatial51. La complexité 
temporelle de la version classique de Wang & Liu s'établit à 
 pour des données 
altimétriques à virgule flottante52. 

L'ingénierie logicielle autour de Priority-Flood a connu des avancées fondamentales au cours de 
la dernière décennie. Les recherches de Barnes et al. (2014) ont démontré qu'une fois qu'une 
dépression est identifiée, son remplissage itératif ne nécessite pas d'utiliser la structure de 
données coûteuse qu'est la file de priorité (priority queue), mais peut être traité par une file 
simple (plain queue). Cette optimisation drastique permet de traiter uniquement les cellules 
critiques via la file de tri, abaissant la complexité effective vers 
 (où M est le 
sous-ensemble des cellules non dépressives), accélérant l'exécution de 15% à 37%52. Plus 
récemment, des travaux empiriques sur l'implémentation des files de priorité en C++ ont prouvé 
que l'utilisation de structures hybrides, telles que le Hash Heap (HHeap, combinant des tables 
de hachage groupées par priorité avec un tas binaire min-heap stricte), offre des gains 
supplémentaires de 10% à 25% de performance sur des MNT contenant des milliards de 
cellules, surpassant les arbres Rouge-Noir ou les listes à saut (Skip Lists)51. Pour une 
application web instantanée, l'intégration du code C++ optimisé de Barnes avec une structure 
de tas performante s'avère être la condition sine qua non du succès52. 
4.3. Simulation des écoulements : Comparaison D8 vs D-Infinity 
Le MNT conditionné permet de déduire la direction des écoulements et l'accumulation du flux. 
Le choix de l'algorithme de routage est déterminant, car il conditionne la nature géométrique du 
bassin versant résultant. 
 
Algorithme de Routage 
Principe Géométrique et 
Direction de Flux 
Implications pour la 
Délimitation Hydrologique 
Algorithme D8 (Steepest 
Descent) 
O'Callaghan et Mark (1984). 
Chaque cellule draine la 
totalité de son flux vers 
l'unique cellule voisine 
présentant la plus forte 
pente descendante (choix 
discrétisé parmi 8 directions 
séparées par 45° : ex. 
Nord=64, Est=1, etc.)1. 
Excellente robustesse pour 
l'identification du réseau de 
drainage primaire et la 
délimitation de bassins 
versants stricts sans 
ambiguïté. Toutefois, il 
échoue à modéliser 
correctement la divergence 
de l'eau sur les versants de 
collines, créant des tracés 
artificiellement parallèles ou 
en zigzag60. 
Algorithme D-Infinity 
(D-Inf / MFD) 
Tarboton (1997). Modèle à 
directions de flux multiples. 
Le vecteur de pente 
maximale est calculé sur 
huit facettes triangulaires. 
Permet une modélisation 
extrêmement réaliste de la 
dispersion des polluants et 
des zones contributives sur 
des reliefs divergents ou 

Le flux est alors partagé 
proportionnellement entre 
une ou deux cellules 
adjacentes, permettant un 
angle continu de 0 à 360°60. 
convergents. Néanmoins, le 
partage fractionné du flux 
rend la création d'un 
polygone de délimitation 
binaire complexe et sujette 
à l'hyper-dispersion60. 
Dans le contexte spécifique de la délimitation de bassins versants, l'algorithme D8 demeure la 
référence absolue1. En imposant un flux univoque, il permet de remonter l'arborescence depuis 
le point exutoire (pour point) jusqu'aux lignes de crête de manière déterministe1. Le calcul de 
l'accumulation de flux compte le nombre total de cellules en amont drainant dans chaque cellule 
courante, formant ainsi l'ossature de la rivière1. Pour compenser l'imprécision du clic de 
l'utilisateur sur la carte interactive web, un algorithme d'accrochage (snap_to_mask) est 
employé : il déplace automatiquement les coordonnées de l'exutoire vers la cellule voisine 
possédant l'accumulation de flux la plus élevée (par exemple, supérieure à 5000 cellules en 
amont), garantissant que le calcul du bassin démarre effectivement dans le lit de la rivière et 
non sur une berge asséchée59. 
5. Architectures de traitement Cloud-Native et 
Serverless 
Exécuter cette séquence algorithmique complexe sans QGIS implique de repenser la 
distribution du calcul. Deux architectures s'opposent et se complètent : l'approche 
Backend-as-a-Service, exécutant des bibliothèques scientifiques sur le cloud, et l'approche 
Client-Side, exploitant la puissance du navigateur de l'utilisateur final. 
5.1. L'approche Backend via Python et l'écosystème Serverless 
L'architecture la plus mature repose sur l'hébergement de fonctions sans serveur (AWS 
Lambda, Google Cloud Functions) orchestrant des bibliothèques Python d'analyse spatiale. La 
bibliothèque PySheds s'est imposée comme le standard de facto pour la délimitation 
hydrologique ultra-rapide en Python59. Elle s'interface idéalement avec les API de données 
altimétriques et procède au traitement matriciel en mémoire vive. 
Le cycle de traitement s'amorce par l'ingestion de la matrice MNT (convertie en objet Grid). Le 
script exécute successivement la méthode fill_pits (pour éliminer les cuvettes d'une seule 
cellule), fill_depressions (pour les dépressions multi-cellulaires) et resolve_flats (pour orienter 
les flux sur les plaines artificielles)65. Le script lance ensuite la fonction flowdir en appliquant le 
routage D8, puis calcule la matrice avec accumulation59. Enfin, l'appel à la fonction 
catchment(x_snap, y_snap, ...) extrait instantanément le masque du bassin versant, qui est 
converti en GeoJSON pour être renvoyé au client web59. 
Des applications similaires telles que mghydro (Global Watersheds App) utilisent ce paradigme 
avec des modules optimisés combinant approches vectorielles et rasters pour délimiter des 
bassins à l'échelle de continents entiers en quelques secondes, surmontant les limites de RAM 

des environnements traditionnels68. Bien que cette architecture backend garantisse l'accès à 
des ressources de calcul massives (essentielles pour l'usage du LiDAR HD), elle présente le 
désavantage de générer une latence réseau significative lors du transfert de polygones de 
bassins comportant des dizaines de milliers de sommets vers le navigateur de l'utilisateur68. 
5.2. L'avant-garde Client-Side : WebAssembly et WebGPU 
La véritable rupture technologique réside dans l'exécution de ces algorithmes 
hydro-informatiques directement sur le processeur du client, supprimant totalement la latence 
liée au serveur. Ce changement de paradigme est rendu possible par WebAssembly (WASM)5. 
WASM est un format binaire standardisé, sécurisé et isolé, exécutable nativement par les 
moteurs JavaScript modernes, offrant des performances comparables à celles du langage 
C++4. Les algorithmes hydrographiques de pointe, tels que le modèle HAND (Height Above 
Nearest Drainage) utilisé pour prédire l'étendue des inondations en temps réel, ou les 
implémentations C++ ultra-optimisées de l'algorithme Priority-Flood (incluant la gestion de 
mémoire HHeap ou Barnes), peuvent être compilés via la chaîne d'outils Emscripten pour 
générer un bytecode WASM43. 
L'architecture est la suivante : l'interface web (développée en React ou Vue.js) récupère la tuile 
MNT compressée (format Zarr ou Cloud Optimized GeoTIFF) via l'API de la Géoplateforme5. Le 
JavaScript transfère la matrice dans l'espace mémoire linéaire du module WASM. Celui-ci 
exécute le remplissage des dépressions, le calcul D8 et la génération du bassin versant en 
quelques millisecondes (une opération de type Fibonacci est exécutée en ~0.1 ms en WASM)6. 
En synergie, WebGPU vient remplacer WebGL pour apporter le calcul massivement parallèle 
(GPGPU) directement dans le navigateur6. Via le langage de shaders WGSL, il devient possible 
de déléguer la simulation de l'accumulation de flux et le tracé de millions de cellules D-Infinity 
aux milliers d'unités de calcul de la carte graphique du client6. Des tests récents démontrent que 
le couplage WASM/WebGPU maintient une cadence d'affichage de 60 images par seconde 
(60fps) pour la mise à jour de systèmes complexes de particules tout en conservant une 
empreinte mémoire globale extrêmement faible (~20 Mo)6. L'initiative open-source qgis-js 
témoigne d'ailleurs de cet élan, en portant directement le cœur C++ des algorithmes QGIS vers 
le web via WebAssembly, rendant l'infrastructure bureautique obsolète2. 
6. Cartographie web interactive : Visualisation et 
animation des données massives 
Délimiter mathématiquement un bassin versant exige de pouvoir le superposer visuellement à 
l'exhaustivité du réseau hydrographique vectoriel. Représenter la BD TOPAGE® (plusieurs 
centaines de milliers de tronçons) sur le web sans figer le navigateur nécessite des techniques 
d'encodage vectoriel fractionné. 
6.1. Tuilage vectoriel, Algorithmique Tippecanoe et le standard 
PMTiles 

Le flux WFS classique, délivrant de larges blocs de GeoJSON, provoque la saturation rapide du 
Document Object Model (DOM) du navigateur40. La solution s'incarne dans les Tuiles 
Vectorielles (Mapbox Vector Tiles). La production de ces tuiles à l'échelle nationale s'effectue 
via l'outil en ligne de commande Tippecanoe74. 
Contrairement aux simplificateurs basiques qui suppriment de l'information, Tippecanoe est 
conçu pour générer une vue indépendante de l'échelle : il préserve la densité et la texture des 
réseaux de données massifs76. La stratégie algorithmique de Tippecanoe pour déterminer le 
niveau de zoom optimal repose sur l'évaluation de la distance géométrique moyenne entre les 
paires de points (d). L'équation logarithmique employée est 
, 
ajustant finement le maillage pour garantir la lisibilité77. Afin d'éviter la génération de tuiles 
obèses excédant 500 Ko, le paramètre --drop-densest-as-needed permet au programme de 
supprimer dynamiquement les cours d'eau les moins significatifs lors du dézoom76. Tippecanoe 
raffine cet écrémage : pour éviter qu'une région rurale n'apparaisse virtuellement aride à petite 
échelle, 40% des points sont sous-échantillonnés uniformément, tandis que les 60% restants 
sont préservés spécifiquement dans les zones géographiquement isolées (stratégie initialement 
conçue pour l'affichage de clusters industriels), garantissant ainsi que la morphologie des 
fleuves majeurs reste cohérente à faible niveau de zoom77. Le flag -zg indique quant à lui au 
logiciel de deviner automatiquement la limite maximale de zoom nécessaire pour refléter la 
précision native des polygones sans gaspillage de ressources74. 
Pour l'hébergement de cette cartographie web, l'abandon des serveurs cartographiques coûteux 
(GeoServer, MapServer) est compensé par le format PMTiles (Protomaps). Un fichier PMTiles 
est une archive unique, contenant la pyramide complète des tuiles vectorielles, stockée 
passivement sur un simple stockage Cloud S3 (architecture serverless absolue)75. Le 
navigateur du client effectue des requêtes HTTP Range Request pour extraire uniquement les 
octets correspondant à la tuile et au niveau de zoom visualisés, annulant virtuellement les coûts 
d'infrastructure83. 
6.2. Rendu et animation avec MapLibre GL JS et deck.gl 
Côté interface client, le moteur de rendu MapLibre GL JS (fork open-source de Mapbox) 
s'impose pour la gestion des tuiles vectorielles83. L'intégration d'un réseau hydrographique 
encapsulé en PMTiles s'opère instantanément via la fonction native 
maplibregl.addProtocol('pmtiles', protocol.tile), interceptant les requêtes réseau pour décoder à 
la volée le protocole spécialisé83. MapLibre supporte nativement la typologie de source 
raster-dem (encodage Terrarium RGB), permettant de draper le modèle d'élévation LiDAR HD 
sous la couche des rivières pour générer un ombrage topographique interactif (hillshading)83. 
Pour transcender la simple visualisation géométrique et simuler dynamiquement les 
écoulements de l'eau au sein du bassin versant délimité, le couplage avec le framework deck.gl 
offre une flexibilité de pointe89. Développé par vis.gl, deck.gl gère des millions d'instances 
géométriques via WebGL. La classe TripsLayer permet d'animer des segments vectoriels le 
long d'une trajectoire définie par des horodatages (timestamps), simulant de manière fluide 
l'écoulement d'une goutte d'eau sur le réseau, reproduisant visuellement le tracé du chemin de 

moindre coût généré par les algorithmes de routage altimétrique de la plateforme89. 
7. Recommandations de synthèse 
Pour concevoir une architecture web performante dédiée à la délimitation et à la simulation de 
bassins hydrographiques, remplaçant intégralement les solutions SIG bureautiques, le 
déploiement doit suivre un continuum technologique strict : 
L'ingestion sémantique des réseaux doit s'appuyer sur la BD TOPAGE® (et HydroSHEDS à 
l'international)11. Ces vecteurs doivent être traités par Tippecanoe pour générer une archive 
PMTiles auto-hébergée (S3), assurant un affichage vectoriel fluide et sans serveur via MapLibre 
GL JS75. 
La logique de traitement doit basculer sur une architecture Client-Side propulsée par 
WebAssembly. Lors du clic utilisateur, l'application invoque l'API de calcul altimétrique de la 
Géoplateforme IGN pour rapatrier la tuile d'élévation LiDAR HD32. Le module WASM exécute en 
quelques millisecondes le conditionnement du terrain : le forçage hydrographique 
(TopologicalBreachBurn) pour contraindre le modèle44, l'algorithme Priority-Flood (variante 
optimisée de Barnes) pour le remplissage des dépressions52, et le routage D8 pour calculer 
l'accumulation et définir l'enveloppe stricte du bassin1. 
Enfin, la visualisation du polygone résultant est instantanément rendue via WebGPU ou deck.gl, 
permettant d'animer les lignes de flux au sein du bassin6. Cette synergie confère aux 
plateformes hydro-informatiques web-natives une résilience, une puissance de calcul et une 
fluidité interactive capables de révolutionner l'analyse spatiale environnementale. 
Works cited 
1.​ Watershed delineation - Wikipedia, 
https://en.wikipedia.org/wiki/Watershed_delineation 
2.​ FOSS4G Europe 2024 - pretalx - OSGeo, 
https://talks.osgeo.org/foss4g-europe-2024/schedule/v/0.5/ 
3.​ Python scripts for global watershed delineation - Reddit, 
https://www.reddit.com/r/Python/comments/yutnex/python_scripts_for_global_wat
ershed_delineation/ 
4.​ Open-source web-based computing libraries and applications for the 
advancement of hydrology research and education, 
https://iro.uiowa.edu/view/pdfCoverPage?instCode=01IOWA_INST&filePid=13981
595750002771&download=true 
5.​ 一般セッション - FOSS4G Hiroshima 2026, 
https://2026.foss4g.org/ja/program-schedule/presentations 
6.​ WebAssembly and WebGPU：High-Performance Computing on the Web | by 
Kevin - Medium, 
https://tianyaschool.medium.com/webassembly-and-webgpu-high-performance-co
mputing-on-the-web-f8f8d67a39d6 
7.​ BD Topage® - Métropole 2025 - Data OFB, 
https://data.ofb.fr/catalogue/data-eaufrance/api/records/fdff993a-0382-4734-8f0c-0

3b9f7b4d83e 
8.​ BD Topage®, 
https://www.geo2france.fr/geonetwork/srv/api/records/7fa4c224-fe38-4e2c-846d-d
cc2fa7ef73e 
9.​ Diffusion du Millésime 2025 de la BD TOPAGE® métropole. - Forum des Marais 
atlantiques, 
https://forum-zones-humides.org/diffusion-du-millesime-2025-de-la-bd-topage-met
ropole/ 
10.​Base de données Topage (HU) - Wikhydro, 
http://wikhydro.developpement-durable.gouv.fr/index.php/Base_de_donn%C3%A9
es_Topage_(HU) 
11.​Administration du Référentiel Hydrographique BD TOPAGE® Sandre - Eaufrance, 
https://www.sandre.eaufrance.fr/ftp/documents/fr/DocAdmin/ETH/1/sandre_admini
stration_topage_1.pdf 
12.​Diffusion du référentiel Hydrographique (BD TOPAGE®) - Sandre - Eaufrance, 
https://www.sandre.eaufrance.fr/ftp/documents/fr/scn/topage/2.0/sandre_scenario
_geo_topage_v2.pdf 
13.​Référentiel Hydrographique - Sandre - Eaufrance, 
https://www.sandre.eaufrance.fr/ftp/documents/fr/pre/eth/2/sandre_pres_eth_2.pdf 
14.​Bassins hydrographiques - Métropole 2024 - BD Topage® - DatARA, 
https://catalogue.open-datara.fr/geonetwork/srv/api/records/f20ce8c9-d8d7-45bc-a
da9-d7ee5ad94eee 
15.​référentiel hydrographique | Sandre - Portail national d'accès aux référentiels sur 
l'eau, https://www.sandre.eaufrance.fr/definition/eth/2002-1 
16.​Point sur : le découpage des aires hydrographiques | Sandre - Portail national 
d'accès aux référentiels sur l'eau, 
https://www.sandre.eaufrance.fr/notice-doc/point-sur-le-d%C3%A9coupage-des-ai
res-hydrographiques 
17.​Bd Carthage - Picto-Occitanie, 
https://catalogue.picto-occitanie.fr/geonetwork/srv/api/records/e07f7920-1d3b-11d
e-97dd-001517506978 
18.​Sous-secteurs hydrographiques - Métropole 2017 - BD Carthage - Sigena, 
https://catalogue.sigena.fr/geonetwork/srv/api/records/7895748c-9991-4647-b03b-
812347dde485 
19.​LE REFERENTIEL HYDROGRAPHIQUE - Sandre, 
http://www.sandre.eaufrance.fr/ftp/documents/fr/pre/eth/2002-1/sandre_presentati
on_ETH_2002-1.pdf 
20.​BD Carthage Métropole / Zones hydrographiques - Sextant (IFREMER), 
https://sextant.ifremer.fr/geonetwork/srv/api/records/2005fa2f-5393-4136-a6de-a5
d4c44404c4 
21.​Zonages Planification - Gest'eau, 
https://www.gesteau.fr/sites/default/files/gesteau/content_files/document/sandre_d
ictionnaire_ZPL_1.pdf 
22.​Hydrobasins - Overview - ArcGIS Online, 
https://www.arcgis.com/home/item.html?id=0a5e451521494dc9bfe0297e4fa7f22d

&sublayer=2 
23.​Watersheds | Resource Watch, 
https://resourcewatch.org/data/explore/wat068rw0-Watersheds 
24.​HydroBASINS Africa – Global Watershed Boundaries and Sub-basin Delineations 
- Dataset, 
https://ihp-wins.unesco.org/dataset/hydrobasins-global-watershed-boundaries-and
-sub-basin-delineations 
25.​HydroATLAS - HydroSHEDS, 
https://data.hydrosheds.org/file/technical-documentation/HydroATLAS_TechDoc_v
10_1.pdf 
26.​HydroBasins | Africa Knowledge Platform - European Union, 
https://africa-knowledge-platform.ec.europa.eu/dataset/hydrobasins 
27.​Global hydro-environmental sub-basin and river reach characteristics at high 
spatial resolution, 
https://research-repository.griffith.edu.au/bitstreams/be3e0863-d7bf-49cb-9706-5e
ffd94c1748/download 
28.​HydroSHEDS v2, https://www.hydrosheds.org/hydrosheds-v2 
29.​HydroSHEDS v2, https://www.hydrosheds.org/products/hydrosheds-v2 
30.​RGE ALTI®, Composante Altimétrique du RGE - Auvergne-Rhône-Alpes - 2021, 
https://demo.georchestra.org/geonetwork/srv/api/records/37d56375-af12-4bda-85
68-8097b1337a1e 
31.​Jeu de données - RGE ALTI® | data.gouv.fr, 
https://www.data.gouv.fr/datasets/rge-alti-r 
32.​Les premiers modèles numériques LiDAR HD sont disponibles et accessibles en 
opendata, 
https://cartes.gouv.fr/actualites/les-premiers-modeles-numeriques-lidar-hd-sont-dis
ponibles-et-accessibles-en-opendata 
33.​Le programme national LiDAR Haute Densité, concrètement aujourd'hui - Portail 
IGN, 
https://www.ign.fr/agenda/le-programme-national-lidar-haute-densite-concretemen
t-aujourdhui 
34.​Cartographie de la France en 3D : un dispositif d'accompagnement pour favoriser 
l'exploitation des données LiDAR - IGN, 
https://www.ign.fr/espace-presse/un-dispositif-daccompagnement-pour-favoriser-l
exploitation-des-donnees-Lidar 
35.​Forum GeoRezo / Difference entre Lidar HD et RGE Alti ?, 
https://georezo.net/forum/viewtopic.php?id=130127 
36.​LiDAR HD IGN 2022 - Open Data Hauts-de-Seine, 
https://opendata.hauts-de-seine.fr/explore/assets/fr-229200506-lidar-hd-ign-2022/ 
37.​The first digital models from the LiDAR HD program are available - ActuIA, 
https://www.actuia.com/en/news/the-first-digital-models-from-the-lidar-hd-program-
are-available/ 
38.​Programme LiDAR HD : vers une nouvelle cartographie 3D du territoire - IGN, 
https://www.ign.fr/institut/programme-lidar-hd-vers-une-nouvelle-cartographie-3d-d
u-territoire 

39.​API Géoplateforme - Calcul altimétrique | data.gouv.fr, 
https://www.data.gouv.fr/dataservices/api-geoplateforme-calcul-altimetrique 
40.​Géoplateforme - IGN, 
https://www.ign.fr/files/default/2023-03/temps_info_gpf_280323.pdf 
41.​Calcul altimétrique | Aide | cartes.gouv.fr, 
https://cartes.gouv.fr/aide/fr/guides-utilisateur/utiliser-les-services-de-la-geoplatefo
rme/calcul-altimetrique/ 
42.​Les routes - Documentation Altimétrie REST API 0.32.1 - IGN, 
https://geoplateforme.pages.gpf-tech.ign.fr/altimetrie/api-rest-calcul-altimetrique/us
age/endpoints.html 
43.​Real-Time Flood Mapping on Client-Side Web Systems Using HAND Model - 
MDPI, https://www.mdpi.com/2306-5338/8/2/65 
44.​The practice of DEM stream burning revisited | Request PDF - ResearchGate, 
https://www.researchgate.net/publication/286925102_The_practice_of_DEM_stre
am_burning_revisited 
45.​The practice of DEM stream burning revisited : Earth Surface Processes and 
Landforms, 
https://www.ovid.com/journals/espl/fulltext/10.1002/esp.3888~the-practice-of-dem-
stream-burning-revisited 
46.​Extracting a Connected River Network from DEM by Incorporating Surface River 
Occurrence Data and Sentinel-2 Imagery in the Danjiangkou Reservoir Area - 
MDPI, https://www.mdpi.com/2072-4292/15/4/1014 
47.​AN ADAPTIVE APPROACH FOR EXTRACTION OF DRAINAGE NETWORK 
FROM SHUTTLE RADAR TOPOGRAPHY MISSION AND SATELLITE IMAGERY 
DATA Wei Yan - ijicic, http://www.ijicic.org/ijicic-10-12001.pdf 
48.​Full article: Review on algorithms of dealing with depressions in grid DEM - Taylor 
& Francis, https://www.tandfonline.com/doi/full/10.1080/19475683.2019.1604571 
49.​Algorithm for Flow Direction Enforcement Using Subgrid-Scale Stream Location 
Data | Journal of Hydrologic Engineering | Vol 16, No 8 - ASCE Library, 
https://ascelibrary.org/doi/abs/10.1061/%28ASCE%29HE.1943-5584.0000340 
50.​An Assessment of Hydrologic Enforcement Methods on Various Drainage 
Features - GIScience 2010, https://giscience2010.org/pdfs/paper_177.pdf 
51.​Full article: Modified Priority-Flood algorithm for hydrologic modelling-based digital 
terrain analysis using a hash heap structure - Taylor & Francis, 
https://www.tandfonline.com/doi/full/10.1080/19475683.2026.2617191 
52.​Priority-Flood: An Optimal Depression-Filling and Watershed-Labeling Algorithm 
for Digital Elevation Models | Request PDF - ResearchGate, 
https://www.researchgate.net/publication/256325936_Priority-Flood_An_Optimal_
Depression-Filling_and_Watershed-Labeling_Algorithm_for_Digital_Elevation_Mo
dels 
53.​Priority-Flood: An Optimal Depression-Filling and Watershed-Labeling Algorithm 
for Digital Elevation Models - Semantic Scholar, 
https://www.semanticscholar.org/paper/Priority-Flood%3A-An-Optimal-Depression
-Filling-and-Barnes-Lehman/2485d7417a7d76bfc57b2283e0b7f79fa7f87afd 
54.​[1511.04463] Priority-Flood: An Optimal Depression-Filling and 

Watershed-Labeling Algorithm for Digital Elevation Models - arXiv, 
https://arxiv.org/abs/1511.04463 
55.​An efficient variant of the Priority-Flood algorithm for filling depressions in raster 
digital elevation models | Request PDF - ResearchGate, 
https://www.researchgate.net/publication/296691359_An_efficient_variant_of_the_
Priority-Flood_algorithm_for_filling_depressions_in_raster_digital_elevation_mode
ls 
56.​Evaluation of Priority Queues in the Priority Flood Algorithm for Hydrological 
Modelling, https://www.mdpi.com/2073-4441/17/22/3202 
57.​Evaluation of Priority Queues in the Priority Flood Algorithm for Hydrological 
Modelling, 
https://www.researchgate.net/publication/397442669_Evaluation_of_Priority_Que
ues_in_the_Priority_Flood_Algorithm_for_Hydrological_Modelling 
58.​Efficient Priority-Flood depression filling in raster digital elevation models | 
Request PDF, 
https://www.researchgate.net/publication/322799609_Efficient_Priority-Flood_depr
ession_filling_in_raster_digital_elevation_models 
59.​Pysheds - Data Science for Energy System Modelling - Fabian Neumann, 
https://fneum.github.io/data-science-for-esm/dsesm/workshop-pysheds/ 
60.​The D8 and D-Infinity Algorithms - Rivix.com, 
https://rivix.com/Topics/D8_vs_Dinf.php 
61.​Flow Direction (Raster Analysis Tools) | ArcGIS Pro documentation - Esri, 
https://doc.esri.com/en/arcgis-pro/latest/tool-reference/raster-analysis/flow-directio
n.html 
62.​Hydrology with a GIS, for the Dummies (that we are): calculation of the flow (4) - 
Blog SIG & Territoires, 
https://www.sigterritoires.fr/index.php/en/hydrology-with-a-gis-for-the-dummies-tha
t-we-are-calculation-of-the-flow-4/ 
63.​Flow Mapping, https://csse.com.au/csim_online_help/flowrouting.html 
64.​Best flow routing algorithm for determining location where spill enters stream?, 
https://gis.stackexchange.com/questions/127709/best-flow-routing-algorithm-for-d
etermining-location-where-spill-enters-stream 
65.​Using PySheds Python Library for Advanced GIS Watershed Modeling - 
Lizardtech, 
https://www.lizardtech.com/post/using-pysheds-python-library-for-advanced-gis-w
atershed-modeling 
66.​pysheds/pysheds: Simple and fast watershed delineation in python - GitHub, 
https://github.com/pysheds/pysheds 
67.​Watershed Delineation With Pysheds - Meteomatics, 
https://www.meteomatics.com/en/blog/watershed-delineation-with-pysheds/ 
68.​November | 2022 | Matthew Heberger, https://mghydro.com/2022/11/ 
69.​Fast, accurate watershed delineation with a hybrid of raster and vector methods - 
Matthew Heberger, https://mghydro.com/pages/Heberger_delineation_2025.pdf 
70.​(PDF) Real-Time Flood Mapping on Client-Side Web Systems Using HAND 
Model, 

https://www.researchgate.net/publication/350843171_Real-Time_Flood_Mapping_
on_Client-Side_Web_Systems_Using_HAND_Model 
71.​Presentations - FOSS4G Hiroshima 2026, 
https://2026.foss4g.org/en/program-schedule/presentations/ 
72.​qgis-js : Infrastructure for AI for Science | SciencePedia - Bohrium, 
https://www.bohrium.com/en/sciencepedia/agent-tools/qgis_qgis-js 
73.​Géoplateforme - IGN, 
https://www.ign.fr/files/default/2023-11/Geoplateforme_La_bascule_des_Geoservi
ces_illustree_cas_d%27usages_21nov23.pdf 
74.​PMTiles example - Cloud-Optimized Geospatial Formats Guide, 
https://guide.cloudnativegeo.org/pmtiles/pmtiles-example.html 
75.​Creating PMTiles - Tippecanoe - Protomaps Docs, 
https://docs.protomaps.com/pmtiles/create 
76.​GitHub - mapbox/tippecanoe: Build vector tilesets from large collections of 
GeoJSON features., https://github.com/mapbox/tippecanoe 
77.​How we make your data look great at every scale with Tippecanoe - Felt, 
https://felt.com/blog/tippecanoe-display-scale-precision 
78.​Tippecanoe optimization and still retaining filtering ability - GIS StackExchange, 
https://gis.stackexchange.com/questions/387948/tippecanoe-optimization-and-still
-retaining-filtering-ability 
79.​The Dark Art of Vector Map Tiling | by Cameron Kruse | Fika - Medium, 
https://medium.com/fika-blog/the-dark-art-of-vector-map-tiling-b417a3813df5 
80.​Guide to creating PMTiles | Tekantis Icon Map, 
https://www.icon-map.com/blog/creating-pmtiles.html 
81.​Vector tile benchmark - TIB AV-Portal, https://av.tib.eu/media/43418 
82.​PMTiles — GDAL documentation, 
https://gdal.org/en/stable/drivers/vector/pmtiles.html 
83.​PMTiles for MapLibre GL - Protomaps Docs, 
https://docs.protomaps.com/pmtiles/maplibre 
84.​Filter within a Layer - MapLibre GL JS, 
https://maplibre.org/maplibre-gl-js/docs/examples/filter-within-a-layer/ 
85.​Filter features within map view with MapLibre GL JS - GIS Stack Exchange, 
https://gis.stackexchange.com/questions/486685/filter-features-within-map-view-wi
th-maplibre-gl-js 
86.​PMTiles source and protocol - MapLibre GL JS, 
https://maplibre.org/maplibre-gl-js/docs/examples/pmtiles-source-and-protocol/ 
87.​addProtocol() - MapLibre GL JS, 
https://maplibre.org/maplibre-gl-js/docs/API/functions/addProtocol/ 
88.​Mapbox Terrain-RGB v1 | Tilesets | Mapbox Docs, 
https://docs.mapbox.com/data/tilesets/reference/mapbox-terrain-rgb-v1/ 
89.​visgl/deck.gl: WebGL2 powered visualization framework - GitHub, 
https://github.com/visgl/deck.gl 
90.​River Runner - Sam Learner, https://river-runner.samlearner.com/ 
91.​River Runner Global - Sam Learner, https://river-runner-global.samlearner.com/ 
92.​Visualize and animate flow in MapView with a custom WebGL layer - Esri, 

https://www.esri.com/arcgis-blog/products/js-api-arcgis/developers/visualize-and-a
nimate-flow-in-mapview-with-a-custom-webgl-layer 
93.​TripsLayer | deck.gl, https://deck.gl/docs/api-reference/geo-layers/trips-layer 
