 
août 2, 2026
Projet Geo x Web 
vizualization 
Pièces jointes 
 
Projet Geo x Web vizualization
Enregistrements de réunions 
 
  
Transcription
Notes par Gemini (Anglais)
 
 
Résumé 
Le développement de la cartographie hydrographique privilégie une approche locale 
ciblée via une architecture web optimisée.​
​
Cadrage géographique du projet​
Le développement se concentrera exclusivement sur la région Jura-Préalpes Nord afin 
de garantir la faisabilité technique et la précision des données pour cette étude initiale.​
​
Optimisation des ressources techniques​
L'utilisation de modèles numériques de terrain standards et de bases de données 
officielles remplace les alternatives plus complexes, facilitant ainsi l'architecture web et 
la maintenance du système.​
​
Gestion centralisée des informations​
Une plateforme unique centralise désormais toutes les spécifications et les recherches 
pour assurer la cohérence du projet tout en évitant la dispersion des données 
critiques. 
 
 

Étapes suivantes 
​[Nathan Ard] Partager visuels vision: Partager des captures d ecran ou des 
exemples de reference sur le projet pour clarifier la vision finale. 
​[Nathan Ard] Ajouter liens Notion: Ajouter les liens vers les donnees de l IGN et 
les sources hydrographiques sur la page Notion partagee. 
​[Nathan Ard] Automatiser hierachie rivieres: Determiner une methode pour 
automatiser la definition des relations de parent et enfant entre les cours d eau. 
​[Silva] Estimer couts hebergement: Calculer les couts de stockage et d 
hebergement pour un volume important de donnees geographiques sur un 
serveur prive virtuel. 
​[Nathan Ard] Rédiger prompt recherche: Rédiger un prompt pour Gemini afin 
de rechercher des données hydrographiques et des bassins versants existants. 
​[Silva] Lancer recherche approfondie: Effectuer une recherche approfondie via 
Gemini pour identifier les couches de données hydrographiques et les bassins 
versants existants. 
​[Nathan Ard] Préparer données QGIS: Préparer les données géographiques et 
les bassins versants pour une zone test définie dans QGIS. 
​[Silva] Créer application web: Développer une application de visualisation web 
pour afficher les bassins versants. 
​[Le groupe] Noter idées: Centraliser les idées et les notes du projet dans Notion. 
​[Nathan Ard] Étudier la solution technique: Analyser les options pour la création 
du site web cartographique. Évaluer la faisabilité technique de la plateforme. 
​[Nathan Ard] Créer bassins versants: Modéliser les bassins versants dans la 
zone hydrocorégion Jura Préalpes. Utiliser les données géographiques 
pertinentes pour la simulation. 
​[Nathan Ard] Résumer rapport Gemini: Synthétiser le rapport généré par 
Gemini. Définir les outils et technologies finaux pour le projet. 
​[Silva] Déployer le projet: Déployer la solution finale sur internet via un agent. 
Intégrer le contexte actuel et les résultats de l IA. 
​[Silva] Mettre à jour Notion: Ajouter le transcript final de la réunion au document 
Notion. Centraliser toutes les informations du projet dans la plateforme. 
 

 
Détails 
●​ Objectif du projet:  : Silva et Nathan Ard initient le développement d'une 
application web visant à afficher des cartes interactives des bassins versants 
hydrographiques, permettant de visualiser et d'explorer des données 
actuellement sous-utilisées (00:00:02) (00:04:27). 
●​ Outil de collaboration:  : Silva met en place Notion comme outil centralisé pour 
gérer les spécifications, les idées et le suivi des tâches, servant de référentiel 
unique pour éviter la dispersion des informations sur d'autres canaux de 
communication (00:01:09) (00:04:27). 
●​ Périmètre du projet:  : Nathan Ard propose de restreindre la zone 
géographique initiale à un ou deux départements, plutôt que de traiter 
l'ensemble du territoire français immédiatement, afin de gérer efficacement le 
volume des données et la complexité de traitement (00:06:16) (00:09:28). 
●​ Sources de données:  : Nathan Ard identifie que les données proviennent de 
l'IGN et de la BD Carthage, nécessitant un traitement spatial spécifique pour 
définir la hiérarchie des réseaux hydrographiques (00:11:42). 
●​ Contraintes techniques:  : Silva souligne les contraintes potentielles de 
mémoire (RAM) et de coût liées aux serveurs VPS, préconisant une stratégie de 
pré-calcul des données pour limiter les traitements lourds en temps réel 
(00:16:13) (00:18:51). 
●​ Concept d'interface utilisateur:  : L'équipe envisage une interface composée 
d'une barre latérale avec des menus déroulants pour naviguer dans la hiérarchie 
des rivières, couplée à une carte interactive offrant des vues en 2D et 
potentiellement en 3D (00:21:06). 
●​ Fonctionnalités de tableau de bord:  : Silva suggère d'intégrer une interface 
de type tableau de bord incluant des fonctions de recherche, des requêtes SQL 
et des widgets visuels pour fournir des indicateurs de performance et des 
analyses de données (00:23:41). 
●​ Fonctionnalités avancées:  : Le projet vise à inclure des capacités 
sophistiquées comme la création de "jumeaux virtuels" et la simulation de 

scénarios complexes, tels que la gestion de barrages ou l'impact de débits d'eau 
sur les infrastructures (00:25:46). 
●​ Analyse des risques naturels:  : Les participants discutent de l'intégration de 
simulations de risques naturels, comme les inondations, pour évaluer l'évolution 
des bassins versants en cas d'événements climatiques extrêmes (00:27:38). 
●​ Évolution temporelle:  : Silva évoque l'idée d'ajouter une frise chronologique 
pour permettre aux utilisateurs de visualiser l'évolution historique des bassins 
versants et d'explorer des projections futures basées sur les changements 
climatiques (00:28:46). 
●​ Défis de hiérarchisation des données:  : Nathan Ard explique qu'il n'existe pas 
de base de données standard pré-établie liant explicitement les rivières entre 
elles (relation parent-enfant), rendant nécessaire une structuration manuelle ou 
algorithmique (00:31:18). 
●​ Stratégie de traitement automatique:  : Afin d'éviter un travail manuel trop 
laborieux, le groupe prévoit d'utiliser des traitements algorithmiques via QGIS 
pour définir automatiquement les hiérarchies de bassins, tout en filtrant les 
affluents mineurs pour maintenir la pertinence des données (00:32:17). 
●​ Plan d'action immédiat:  : Les participants conviennent d'un délai de deux 
jours pour préparer le travail : Nathan Ard se concentrera sur le traitement des 
données et la définition des hiérarchies dans QGIS, tandis que Silva s'occupera 
de la mise en place de l'architecture web et de l'environnement de déploiement 
(00:36:13). 
●​ Recherche assistée par IA:  : Silva propose d'utiliser Gemini pour effectuer une 
recherche approfondie sur l'existence de données hydrographiques 
pré-hiérarchisées, chargeant Nathan Ard de rédiger un prompt précis pour 
cette requête (00:38:16). 
●​ Modélisation des relations:  : Silva et Nathan Ard définissent la structure de la 
base de données comme un graphe ou un arbre, où chaque élément de cours 
d'eau conserve une information sur son parent pour permettre une navigation 
récursive (00:42:37) (00:45:26). 
●​ Intégration géographique:  : La discussion souligne la nécessité de lier deux 
types de jeux de données distincts (les couches géographiques des 

départements et les réseaux hydrographiques) pour créer des visualisations 
fonctionnelles et cohérentes (00:46:35). 
●​ Approche algorithmique de liaison:  : Les participants concluent qu'en 
l'absence de données pré-existantes, ils utiliseront des techniques de 
géotraitement (zones tampons, intersections) pour automatiser la création des 
liens entre les cours d'eau et les bassins versants (00:55:11) (00:56:55). 
●​ Méthodologie de définition des bassins versants: Silva et Nathan Ard 
discutent de la méthode pour délimiter les bassins versants à partir des cours 
d'eau. Nathan Ard propose une approche basée sur une distance fixe par 
rapport aux cours d'eau, mais reconnaît qu'elle manque de précision 
géographique, tandis que Silva souligne le risque d'erreurs d'attribution dans les 
zones à forte pente (00:57:54). Ils conviennent que, bien que cette méthode soit 
localement fine, elle ne remplace pas une analyse topographique basée sur les 
lignes de crête (00:58:55). 
●​ Approche technique des frontières de bassins: La discussion porte sur la 
gestion des frontières entre bassins. Silva et Nathan Ard envisagent une 
approche où les zones s'étendent jusqu'à se toucher, créant une frontière 
distincte plutôt qu'une zone tampon arbitraire. Cependant, ils admettent que 
cette méthode pourrait ne pas gérer des cas complexes comme des zones 
isolées ou imperméables, conduisant à des classifications potentiellement 
erronées de l'écoulement de l'eau (00:59:41). 
●​ Outils de gestion de projet et documentation: Afin d'éviter la perte d'idées 
et de faciliter le partage, Silva et Nathan Ard conviennent d'utiliser Notion pour 
centraliser toutes les notes, les liens et le contexte du projet. Silva propose 
d'utiliser des outils d'intelligence artificielle pour générer des recherches 
approfondies et de conserver ces informations dans l'espace de travail partagé 
(01:01:21). 
●​ Architecture technique et cartographie web: Les participants débattent de 
la solution technique pour le développement de l'application. Nathan Ard 
exprime des réserves quant à la dépendance stricte envers QGIS, préférant une 
solution web plus accessible (01:05:57). Silva souligne la nécessité d'une solution 
autonome ne nécessitant pas une maintenance constante sous QGIS, et ils 
décident de demander des conseils techniques via une intelligence artificielle 
sur les bases de données et l'architecture web (01:08:52). 

●​ Recherche de sources de données hydrographiques officielles: Silva et 
Nathan Ard passent en revue le plan de recherche généré par l'outil Gemini. Le 
plan inclut l'examen de bases de données officielles françaises comme le 
Cendre, la BD Topage, et la BD Carthage (IGN/OFB), ainsi que des données 
internationales comme HydroSHEDS. Ils valident cette stratégie pour obtenir les 
réseaux de cours d'eau et les contours des bassins versants plutôt que de 
s'appuyer uniquement sur un traitement manuel (01:11:21). 
●​ Sélection de la zone géographique d'étude: Ils discutent de la portée 
géographique du projet, excluant la France entière pour rester efficace. Nathan 
Ard suggère de se concentrer sur une zone montagneuse, écartant des régions 
trop planes comme la Beauce. Ils conviennent de tester l'algorithme sur une 
zone plus restreinte, comme le sud-est ou une région spécifique, pour assurer la 
faisabilité technique avant une extension éventuelle (01:14:13) (01:18:13). 
●​ Identification précise de la zone d'étude (Écorégions): Nathan Ard et Silva 
identifient la zone cible comme étant l'hydro-écorégion "Jura-Préalpes Nord". 
Nathan Ard explique que ces écorégions sont délimitées par la géologie, le relief 
et le climat, offrant ainsi une homogénéité nécessaire pour les calculs de 
modélisation (01:19:00). 
●​ Interopérabilité et agrégation des données: Une préoccupation est soulevée 
concernant la compatibilité entre les différentes sources de données (IGN, 
HydroSHEDS, HydroBassin). Silva insiste sur la nécessité de vérifier si ces bases 
de données utilisent des nomenclatures cohérentes pour permettre une 
agrégation fluide, afin d'éviter des problèmes d'intégration lors du 
développement (01:25:01). 
●​ Utilisation de données Lidar pour la modélisation: Nathan Ard explore 
l'utilisation de données Lidar pour atteindre une haute précision dans la 
modélisation des bassins, notamment pour identifier l'exposition des versants 
(01:28:47) (01:30:31). Bien que Silva reconnaisse l'intérêt du Lidar pour la 3D, ils 
concluent ensemble que l'utilisation de Modèles Numériques de Terrain (MNT) 
standards pourrait suffire pour les besoins actuels du projet, évitant ainsi un 
traitement de données trop lourd (01:29:35) (01:31:09). 
 
 

Nous vous conseillons d'examiner les notes de Gemini pour vérifier qu'elles ne 
contiennent pas d'erreur. Profitez de nos astuces et découvrez comment Gemini 
prend des notes 
Que pensez-vous de la qualité de ces notes spécifiques ? Participez à une courte 
enquête pour nous faire part de vos commentaires et nous dire si ces notes vous ont 
été utiles. 
