/**
 * Load Agency CRM — synchronisation Google Drive → Suivi Contenu
 * ============================================================
 *
 * À coller dans script.google.com (Nouveau projet → remplacer tout le code).
 *
 * Ce script tourne sous TON compte Google : il voit tous les dossiers auxquels
 * tu as accès, sans compte de service ni clé JSON à gérer.
 *
 * Il ne décide de rien. Il liste les fichiers nouveaux et les envoie au CRM,
 * qui reste seul juge des doublons : chaque fichier est identifié par son ID
 * Drive, et une contrainte d'unicité en base rend l'opération rejouable.
 * Perdre le curseur de ce script ne crée donc jamais de doublon.
 *
 * ── Configuration ───────────────────────────────────────────────────────────
 */

var CRM_URL = 'https://load-agency-crm.vercel.app'; // sans slash final
var SECRET = 'COLLE_ICI_LE_MEME_SECRET_QUE_DANS_VERCEL';

/** Nombre de jours d'historique repris au tout premier passage. */
var FIRST_RUN_LOOKBACK_DAYS = 30;

/** Plafond de fichiers traités par exécution (Apps Script coupe à 6 minutes). */
var MAX_FILES_PER_RUN = 250;

/** Chevauchement appliqué au curseur, pour absorber les horloges décalées. */
var OVERLAP_MINUTES = 15;

/**
 * ── Installation ────────────────────────────────────────────────────────────
 *
 * 1. Renseigne CRM_URL et SECRET ci-dessus.
 * 2. Menu déroulant des fonctions → « testConnection » → Exécuter.
 *    Autorise le script quand Google le demande.
 *    Consulte Exécutions : tu dois voir la liste de tes créatrices.
 * 3. Menu déroulant → « syncNow » → Exécuter, pour un premier passage réel.
 * 4. Icône Déclencheurs (réveil) → Ajouter un déclencheur :
 *       Fonction        : syncDrive
 *       Source          : Déclencheur horaire
 *       Type            : Minuteur (par minutes) → toutes les 10 minutes
 *
 * ── Ce que le script attend de ton Drive ────────────────────────────────────
 *
 * Tous les sous-dossiers du dossier racine sont repris tels quels : leur nom
 * devient une catégorie dans le CRM. Rien à renommer, rien à déclarer.
 *
 * Le chiffre de tête, quand il existe (« 4- NUDE PICS »), sert uniquement à
 * l'ordre d'affichage et à faire correspondre « le dossier 4 » d'une créatrice
 * à l'autre. Un dossier sans numéro apparaît quand même, en fin de liste.
 *
 * Les fichiers doivent être posés dans ces dossiers ; le script descend d'un
 * niveau supplémentaire au maximum, et rattache alors le fichier au dossier
 * de catégorie parent.
 */

/**
 * À exécuter en premier, une seule fois.
 *
 * Volontairement SANS try/catch : c'est l'exception non capturée qui déclenche
 * l'écran d'autorisation de Google. Les autres fonctions attrapent leurs
 * erreurs pour ne pas interrompre la synchronisation, ce qui a l'effet de bord
 * d'empêcher Google de demander les accès manquants.
 *
 * On touche les deux services — réseau et Drive — pour que les deux
 * autorisations soient demandées d'un coup.
 */
function autoriser() {
  var res = UrlFetchApp.fetch(CRM_URL + '/api/content/ingest', {
    method: 'get',
    headers: { 'x-ingest-secret': SECRET },
    muteHttpExceptions: true,
  });
  var code = res.getResponseCode();
  DriveApp.getRootFolder().getName();

  Logger.log('Autorisations accordées.');
  Logger.log('Réponse du CRM : ' + code);
  if (code === 200) {
    Logger.log('Le secret est bon. Tu peux lancer testConnection.');
  } else if (code === 401) {
    Logger.log('ATTENTION : secret refusé. Vérifie la variable SECRET en haut du script.');
  } else {
    Logger.log('Réponse inattendue : ' + res.getContentText());
  }
}

function syncDrive() {
  var started = Date.now();
  var targets = fetchTargets();
  if (!targets) return;

  var props = PropertiesService.getScriptProperties();
  var report = [];

  for (var t = 0; t < targets.length; t++) {
    // Marge : on s'arrête avant la coupure à 6 minutes d'Apps Script.
    if (Date.now() - started > 4 * 60 * 1000) {
      Logger.log('Temps écoulé, reprise au prochain déclenchement.');
      break;
    }
    report.push(syncOneModel(targets[t], props));
  }

  Logger.log(report.join('\n'));
}

/** Passage manuel : ignore les curseurs et reprend les 30 derniers jours. */
function syncNow() {
  PropertiesService.getScriptProperties().deleteAllProperties();
  syncDrive();
}

/** Vérifie l'URL et le secret sans rien écrire. */
function testConnection() {
  var targets = fetchTargets();
  if (!targets) return;
  Logger.log('Connexion OK. ' + targets.length + ' créatrice(s) avec un lien Drive :');
  for (var i = 0; i < targets.length; i++) {
    var f = safeFolder(targets[i].folderId);
    Logger.log(
      ' - ' + targets[i].name +
      ' → ' + (f ? 'dossier « ' + f.getName() +' » accessible' : 'DOSSIER INACCESSIBLE'),
    );
  }
}

function fetchTargets() {
  try {
    var res = UrlFetchApp.fetch(CRM_URL + '/api/content/ingest', {
      method: 'get',
      headers: { 'x-ingest-secret': SECRET },
      muteHttpExceptions: true,
    });
    if (res.getResponseCode() !== 200) {
      Logger.log('Le CRM a répondu ' + res.getResponseCode() + ' : ' + res.getContentText());
      return null;
    }
    return JSON.parse(res.getContentText()).targets || [];
  } catch (e) {
    Logger.log('Impossible de joindre le CRM : ' + e);
    return null;
  }
}

function safeFolder(id) {
  try {
    return DriveApp.getFolderById(id);
  } catch (e) {
    return null;
  }
}

function syncOneModel(target, props) {
  var root = safeFolder(target.folderId);
  if (!root) return target.name + ' : dossier introuvable ou non partagé.';

  var cursorKey = 'cursor_' + target.modelId;
  var since = props.getProperty(cursorKey);
  if (!since) {
    var d = new Date();
    d.setDate(d.getDate() - FIRST_RUN_LOOKBACK_DAYS);
    since = d.toISOString();
  }
  var sinceDate = new Date(since);
  sinceDate.setMinutes(sinceDate.getMinutes() - OVERLAP_MINUTES);

  // On recopie l'arborescence telle quelle : le CRM n'impose aucune liste de
  // catégories, il affiche les dossiers réels de la créatrice.
  var folders = [];
  var found = [];
  var subs = root.getFolders();
  while (subs.hasNext()) {
    var sub = subs.next();
    folders.push({
      folderId: sub.getId(),
      name: sub.getName(),
      position: positionFromFolderName(sub.getName()),
    });
    if (found.length < MAX_FILES_PER_RUN) {
      collectFiles(sub, sub.getId(), sinceDate, found, 0);
    }
  }

  folders.sort(function (a, b) {
    return a.position - b.position;
  });

  if (found.length === 0) {
    // Même sans nouveau fichier, on transmet l'arborescence : un dossier créé
    // ou renommé doit apparaître dans le CRM sans attendre un dépôt.
    postFiles(target.modelId, folders, []);
    return target.name + ' : rien de nouveau (' + folders.length + ' dossiers).';
  }

  found.sort(function (a, b) {
    return a.createdAt < b.createdAt ? -1 : 1;
  });
  var batch = found.slice(0, MAX_FILES_PER_RUN);

  var result = postFiles(target.modelId, folders, batch);
  if (!result) return target.name + " : l'envoi au CRM a échoué, curseur inchangé.";

  // Le curseur n'avance que sur ce qui a été effectivement transmis.
  props.setProperty(cursorKey, batch[batch.length - 1].createdAt);

  return target.name + ' : ' + result.inserted + ' ajouté(s), ' + result.skipped + ' déjà connu(s), '
    + folders.length + ' dossiers'
    + (found.length > batch.length ? ', reste ' + (found.length - batch.length) + ' au prochain passage.' : '.');
}

/**
 * Un seul niveau de sous-dossier sous la catégorie, pour éviter les boucles.
 * `folderKey` est l'identifiant Drive du dossier de catégorie : les fichiers
 * rangés dans un sous-sous-dossier restent rattachés à la catégorie parente.
 */
function collectFiles(folder, folderKey, sinceDate, out, depth) {
  var files = folder.getFiles();
  while (files.hasNext() && out.length < MAX_FILES_PER_RUN) {
    var f = files.next();
    var created = f.getDateCreated();
    if (created < sinceDate) continue;
    out.push({
      driveFileId: f.getId(),
      name: f.getName(),
      category: folderKey,
      createdAt: created.toISOString(),
    });
  }
  if (depth >= 1) return;
  var subs = folder.getFolders();
  while (subs.hasNext() && out.length < MAX_FILES_PER_RUN) {
    collectFiles(subs.next(), folderKey, sinceDate, out, depth + 1);
  }
}

/**
 * Le chiffre de tête du dossier, ou 999 s'il n'y en a pas.
 *
 * Ce numéro n'identifie pas le dossier — c'est l'identifiant Drive qui le fait.
 * Il sert uniquement à l'ordre d'affichage et à faire correspondre « le dossier
 * 4 » d'une créatrice à l'autre quand l'agence adresse une demande groupée.
 */
function positionFromFolderName(name) {
  var m = String(name).match(/^\s*(\d+)/);
  return m ? parseInt(m[1], 10) : 999;
}

function postFiles(modelId, folders, files) {
  try {
    var res = UrlFetchApp.fetch(CRM_URL + '/api/content/ingest', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-ingest-secret': SECRET },
      payload: JSON.stringify({ modelId: modelId, folders: folders, files: files }),
      muteHttpExceptions: true,
    });
    if (res.getResponseCode() !== 200) {
      Logger.log('CRM ' + res.getResponseCode() + ' : ' + res.getContentText());
      return null;
    }
    return JSON.parse(res.getContentText());
  } catch (e) {
    Logger.log('Envoi impossible : ' + e);
    return null;
  }
}
