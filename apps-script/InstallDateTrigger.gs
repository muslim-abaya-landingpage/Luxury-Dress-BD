function installBoostAutoDateTriggerNow() {
  const triggers = ScriptApp.getProjectTriggers();
  const exists = triggers.some(t => t.getHandlerFunction() === 'boostAutoDateOnEdit' && t.getEventType() === ScriptApp.EventType.ON_EDIT);
  if (!exists) {
    ScriptApp.newTrigger('boostAutoDateOnEdit').forSpreadsheet(SpreadsheetApp.getActive()).onEdit().create();
  }
}