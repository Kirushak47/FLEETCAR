/* FleetPilot document attachment bridge — all new document files live in Supabase Storage. */
(()=>{'use strict';
 const MAX=25*1024*1024;
 const Files=()=>window.FleetPilotFiles||window.FleetPilot?.Files;
 const legacy={
  save:window.saveDocumentFile,
  get:window.getDocumentFile,
  del:window.deleteDocumentFile,
  open:window.openDocumentAttachment,
  download:window.downloadDocumentAttachment
 };
 const ready=()=>{const f=Files();if(!f?.upload||!f?.get)throw new Error('Облачное хранилище ещё не готово');return f};
 async function cloudRecord(id){if(!id)return null;try{return await ready().get(id)}catch(error){console.warn('FleetPilot cloud file lookup',error);return null}}
 async function saveDocumentFileCloud(file,documentId,existingId=''){
  if(!file)return existingId||'';
  if(file.size>MAX)throw new Error('Максимальный размер файла — 25 МБ');
  const f=ready();
  const previous=existingId?await cloudRecord(existingId):null;
  const uploaded=await f.upload(file,{entityType:'document',entityId:String(documentId),category:'document-attachment'});
  if(previous){try{await f.remove(previous)}catch(error){console.warn('Old cloud document cleanup failed',error)}}
  else if(existingId&&legacy.del){try{await legacy.del(existingId)}catch(error){console.warn('Old local document cleanup failed',error)}}
  return uploaded.id
 }
 async function getDocumentFileCloud(id){
  const row=await cloudRecord(id);
  if(row)return{id:row.id,documentId:row.entity_id,name:row.original_name,type:row.mime_type||'application/octet-stream',size:Number(row.size_bytes||0),updatedAt:row.created_at,cloud:true,storagePath:row.storage_path,record:row};
  return legacy.get?legacy.get(id):null
 }
 async function deleteDocumentFileCloud(id){const row=await cloudRecord(id);if(row)return ready().remove(row);return legacy.del?legacy.del(id):undefined}
 async function openDocumentAttachmentCloud(fileId,title='Документ'){
  const row=await cloudRecord(fileId);
  if(row){try{await ready().open(row);return}catch(error){console.error(error);window.toast?.(error.message||'Не удалось открыть файл');return}}
  if(legacy.open)return legacy.open(fileId,title);
  window.toast?.('Файл не найден')
 }
 async function downloadDocumentAttachmentCloud(fileId){
  const row=await cloudRecord(fileId);
  if(row){try{await ready().download(row,row.original_name);return}catch(error){console.error(error);window.toast?.(error.message||'Не удалось скачать файл');return}}
  if(legacy.download)return legacy.download(fileId)
 }
 // Global function declarations from the legacy bundle resolve through these window bindings.
 window.saveDocumentFile=saveDocumentFileCloud;
 window.getDocumentFile=getDocumentFileCloud;
 window.deleteDocumentFile=deleteDocumentFileCloud;
 window.openDocumentAttachment=openDocumentAttachmentCloud;
 window.downloadDocumentAttachment=downloadDocumentAttachmentCloud;
 window.FleetPilot=window.FleetPilot||{};
 window.FleetPilot.DocumentFiles={save:saveDocumentFileCloud,get:getDocumentFileCloud,remove:deleteDocumentFileCloud,open:openDocumentAttachmentCloud,download:downloadDocumentAttachmentCloud,isCloudId:async id=>!!(await cloudRecord(id))};
 window.dispatchEvent(new CustomEvent('fleetpilot:document-cloud-ready'));
})();