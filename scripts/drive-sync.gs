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
 * 3. Menu déroulant → « verifierDossiers » → Exécuter, pour voir l'arborescence
 *    réelle de chaque créatrice sans rien écrire.
 * 4. Menu déroulant → « syncNow » → Exécuter, pour un premier passage réel.
 * 5. Icône Déclencheurs (réveil) → Ajouter un déclencheur :
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

/**
 * Deux passes, et l'ordre compte.
 *
 * La découverte de l'arborescence est rapide ; la collecte des fichiers est
 * lente et bute sur la limite de 6 minutes d'Apps Script. Les mélanger — ce que
 * faisait la version précédente — laissait les dernières créatrices sans aucun
 * dossier remonté : le CRM affichait alors l'arborescence type de l'agence au
 * lieu de la leur, sans que rien ne signale le problème.
 *
 * On remonte donc TOUTES les arborescences d'abord, puis on collecte les
 * fichiers tant qu'il reste du temps. Un dépôt qui attend le passage suivant
 * n'a aucune conséquence ; un dossier absent, si.
 */
function syncDrive() {
  var started = Date.now();
  var targets = fetchTargets();
  if (!targets) return;

  var props = PropertiesService.getScriptProperties();
  var report = [];
  var trees = [];

  // ── Passe 1 : l'arborescence de chaque créatrice ──────────────────────────
  for (var t = 0; t < targets.length; t++) {
    var target = targets[t];
    var root = safeFolder(target.folderId);
    if (!root) {
      report.push(target.name + ' : dossier introuvable ou non partagé.');
      continue;
    }
    var folders = listFolders(root);
    if (folders.length === 0) {
      report.push(target.name + ' : AUCUN sous-dossier dans le Drive.');
      continue;
    }
    postFiles(target.modelId, folders, []);
    trees.push({ target: target, root: root, folders: folders });
  }

  // ── Passe 2 : les fichiers ────────────────────────────────────────────────
  for (var i = 0; i < trees.length; i++) {
    if (Date.now() - started > 4 * 60 * 1000) {
      report.push('Temps écoulé, ' + (trees.length - i) + ' créatrice(s) reprise(s) au prochain passage.');
      break;
    }
    report.push(collectForModel(trees[i], props));
  }

  Logger.log(report.join('\n'));
}

/** Les sous-dossiers directs du dossier racine, triés par leur numéro. */
function listFolders(root) {
  var folders = [];
  var subs = root.getFolders();
  while (subs.hasNext()) {
    var sub = subs.next();
    folders.push({
      folderId: sub.getId(),
      name: sub.getName(),
      position: positionFromFolderName(sub.getName()),
    });
  }
  folders.sort(function (a, b) {
    return a.position - b.position;
  });
  return folders;
}

/**
 * Compare l'arborescence réelle du Drive à ce que le CRM en connaît.
 * Ne modifie rien : à lancer quand un dossier semble manquer côté CRM.
 */
function verifierDossiers() {
  var targets = fetchTargets();
  if (!targets) return;

  Logger.log('Vérification de ' + targets.length + ' créatrice(s) :');
  for (var t = 0; t < targets.length; t++) {
    var target = targets[t];
    var root = safeFolder(target.folderId);
    if (!root) {
      Logger.log(' ✗ ' + target.name + ' : DOSSIER INACCESSIBLE');
      continue;
    }
    var folders = listFolders(root);
    if (folders.length === 0) {
      Logger.log(' ✗ ' + target.name + ' : aucun sous-dossier dans « ' + root.getName() + ' »');
      continue;
    }
    var names = [];
    for (var f = 0; f < folders.length; f++) names.push(folders[f].name);
    Logger.log(' • ' + target.name + ' — ' + folders.length + ' dossiers : ' + names.join(' | '));
  }
  Logger.log('Lance syncDrive pour transmettre ces arborescences au CRM.');
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

/** Collecte les fichiers nouveaux d'une créatrice dont l'arborescence est connue. */
function collectForModel(tree, props) {
  var target = tree.target;
  var folders = tree.folders;

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
  for (var i = 0; i < folders.length && found.length < MAX_FILES_PER_RUN; i++) {
    var sub = safeFolder(folders[i].folderId);
    if (sub) collectFiles(sub, folders[i].folderId, sinceDate, found, 0);
  }

  if (found.length === 0) {
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
