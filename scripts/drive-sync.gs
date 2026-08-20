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

var CRM_URL = 'https://TON-APP.vercel.app'; // sans slash final
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
 * Le dossier de chaque créatrice contient des sous-dossiers dont le nom
 * COMMENCE par le numéro de la catégorie :
 *
 *   1- SCRIPTS   2- FEED POSTS   3- DRESSED PICS   4- NUDE PICS
 *   5- NUDE VIDS   6 - COLLAB / ANAL   7- FEET CONTENT   8-MARKETING CLIPS
 *
 * Seul le chiffre de tête compte : « 4- NUDE PICS », « 4 - Nude pics » et
 * « 4_nudes » sont traités pareil. Un sous-dossier sans numéro est ignoré.
 * Les fichiers doivent être posés directement dans ces dossiers ; le script
 * descend d'un niveau supplémentaire au maximum.
 */

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

  var found = [];
  var subs = root.getFolders();
  while (subs.hasNext() && found.length < MAX_FILES_PER_RUN) {
    var sub = subs.next();
    var category = categoryFromFolderName(sub.getName());
    if (!category) continue;
    collectFiles(sub, category, sinceDate, found, 0);
  }

  if (found.length === 0) return target.name + ' : rien de nouveau.';

  found.sort(function (a, b) {
    return a.createdAt < b.createdAt ? -1 : 1;
  });
  var batch = found.slice(0, MAX_FILES_PER_RUN);

  var result = postFiles(target.modelId, batch);
  if (!result) return target.name + " : l'envoi au CRM a échoué, curseur inchangé.";

  // Le curseur n'avance que sur ce qui a été effectivement transmis.
  props.setProperty(cursorKey, batch[batch.length - 1].createdAt);

  return target.name + ' : ' + result.inserted + ' ajouté(s), ' + result.skipped + ' déjà connu(s)'
    + (found.length > batch.length ? ', reste ' + (found.length - batch.length) + ' au prochain passage.' : '.');
}

/** Un seul niveau de sous-dossier sous la catégorie, pour éviter les boucles. */
function collectFiles(folder, category, sinceDate, out, depth) {
  var files = folder.getFiles();
  while (files.hasNext() && out.length < MAX_FILES_PER_RUN) {
    var f = files.next();
    var created = f.getDateCreated();
    if (created < sinceDate) continue;
    out.push({
      driveFileId: f.getId(),
      name: f.getName(),
      category: category,
      createdAt: created.toISOString(),
    });
  }
  if (depth >= 1) return;
  var subs = folder.getFolders();
  while (subs.hasNext() && out.length < MAX_FILES_PER_RUN) {
    collectFiles(subs.next(), category, sinceDate, out, depth + 1);
  }
}

var CATEGORY_BY_INDEX = {
  1: 'scripts',
  2: 'feed',
  3: 'dressed_pics',
  4: 'nude_pics',
  5: 'nude_vids',
  6: 'collab',
  7: 'feet',
  8: 'marketing',
};

function categoryFromFolderName(name) {
  var m = String(name).match(/^\s*(\d+)/);
  if (!m) return null;
  return CATEGORY_BY_INDEX[parseInt(m[1], 10)] || null;
}

function postFiles(modelId, files) {
  try {
    var res = UrlFetchApp.fetch(CRM_URL + '/api/content/ingest', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-ingest-secret': SECRET },
      payload: JSON.stringify({ modelId: modelId, files: files }),
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
