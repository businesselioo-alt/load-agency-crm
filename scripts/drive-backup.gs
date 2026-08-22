/**
 * Load Agency CRM — sauvegarde quotidienne de la base vers Google Drive
 * ====================================================================
 *
 * À ajouter dans le MÊME projet Apps Script que la synchronisation Drive :
 * Fichiers → + → Script → coller ce fichier.
 *
 * Il appelle /api/backup, qui renvoie l'intégralité de la base en JSON, et
 * dépose le fichier dans un dossier de ton Drive. Rien n'est modifié dans le
 * CRM : c'est une lecture seule.
 *
 * Pourquoi ce script existe : Supabase en offre gratuite ne fait aucune
 * sauvegarde. Sans copie externe, un DELETE malheureux ou un projet supprimé
 * emporte tout, sans recours.
 *
 * ── Configuration ───────────────────────────────────────────────────────────
 *
 * CRM_URL et SECRET sont déjà définis dans le fichier de synchronisation du
 * même projet ; ne les redéclare pas ici.
 */

/** Nom du dossier Drive qui reçoit les sauvegardes. Créé au premier passage. */
var BACKUP_FOLDER_NAME = 'CRM Backups';

/** Sauvegardes conservées. Au-delà, la plus ancienne est supprimée. */
var KEEP_BACKUPS = 60;

/**
 * ── Installation ────────────────────────────────────────────────────────────
 *
 * 1. Menu déroulant des fonctions → « backupNow » → Exécuter.
 *    Vérifie dans Exécutions que le fichier a bien été écrit.
 * 2. Icône Déclencheurs → Ajouter un déclencheur :
 *       Fonction  : backupCRM
 *       Source    : Déclencheur horaire
 *       Type      : Minuteur journalier → entre 3h et 4h du matin
 *
 * ── Restauration ────────────────────────────────────────────────────────────
 *
 * Le fichier JSON contient une clé par table, chacune avec ses lignes telles
 * qu'elles étaient. Pour restaurer, télécharge-le et demande-moi le script
 * d'import : je le génère à partir du contenu réel du fichier, ce qui évite de
 * réinjecter à l'aveugle une structure qui aurait changé depuis.
 */

function backupCRM() {
  var res;
  try {
    res = UrlFetchApp.fetch(CRM_URL + '/api/backup', {
      method: 'get',
      headers: { 'x-ingest-secret': SECRET },
      muteHttpExceptions: true,
    });
  } catch (e) {
    Logger.log('Sauvegarde impossible, CRM injoignable : ' + e);
    return;
  }

  if (res.getResponseCode() !== 200) {
    Logger.log('Le CRM a répondu ' + res.getResponseCode() + ' : ' + res.getContentText());
    return;
  }

  var text = res.getContentText();

  // On relit le JSON avant d'écrire : une réponse tronquée par une coupure
  // réseau produirait un fichier illisible le jour où on en aurait besoin.
  var data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    Logger.log('Réponse illisible, sauvegarde abandonnée : ' + e);
    return;
  }
  if (!data.tables || data.tableCount === 0) {
    Logger.log('Réponse vide, sauvegarde abandonnée.');
    return;
  }

  var folder = getOrCreateFolder(BACKUP_FOLDER_NAME);
  var name = 'crm-backup-' + isoDay() + '.json';

  // Une seule sauvegarde par jour : on remplace celle du jour si elle existe,
  // pour qu'une exécution manuelle ne mange pas la rotation.
  var existing = folder.getFilesByName(name);
  while (existing.hasNext()) existing.next().setTrashed(true);

  folder.createFile(name, text, 'application/json');

  Logger.log(
    'Sauvegarde écrite : ' + name +
    ' — ' + data.tableCount + ' tables, ' + data.totalRows + ' lignes, ' +
    Math.round(text.length / 1024) + ' Ko',
  );

  var skipped = Object.keys(data.skipped || {});
  if (skipped.length > 0) {
    Logger.log('Tables ignorées (absentes de la base) : ' + skipped.join(', '));
  }

  rotate(folder);
}

/** Sauvegarde manuelle. Identique, nommée à part pour être lancée à la main. */
function backupNow() {
  backupCRM();
}

function getOrCreateFolder(name) {
  var it = DriveApp.getFoldersByName(name);
  return it.hasNext() ? it.next() : DriveApp.createFolder(name);
}

function isoDay() {
  return Utilities.formatDate(new Date(), 'Etc/UTC', 'yyyy-MM-dd');
}

/** Supprime les sauvegardes au-delà de KEEP_BACKUPS, la plus ancienne d'abord. */
function rotate(folder) {
  var files = [];
  var it = folder.getFilesByType('application/json');
  while (it.hasNext()) {
    var f = it.next();
    if (f.getName().indexOf('crm-backup-') === 0) {
      files.push({ file: f, date: f.getDateCreated() });
    }
  }
  if (files.length <= KEEP_BACKUPS) return;

  files.sort(function (a, b) {
    return a.date - b.date;
  });

  var toDelete = files.length - KEEP_BACKUPS;
  for (var i = 0; i < toDelete; i++) {
    files[i].file.setTrashed(true);
  }
  Logger.log(toDelete + ' ancienne(s) sauvegarde(s) supprimée(s).');
}
