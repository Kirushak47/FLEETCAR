/* FleetPilot shared cloud file storage — Supabase Storage + workspace_files metadata */
(()=>{'use strict';
 const FP=window.FleetPilot=window.FleetPilot||{};
 const BUCKET='fleet-files';
 const client=()=>window.__FLEETPILOT_SUPABASE_CLIENT__||window.FleetPilotCloud?.client||null;
 const workspaceId=()=>window.FleetPilotCloud?.membership?.workspace_id||window.FleetPilotCloud?.workspace?.id||'';
 const userId=()=>window.FleetPilotCloud?.session?.user?.id||'';
 const clean=s=>String(s||'file').normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g,'_').replace(/^_+|_+$/g,'').slice(0,120)||'file';
 const uid=()=>crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;
 function assertReady(){const c=client(),ws=workspaceId();if(!c)throw new Error('Supabase недоступен');if(!ws)throw new Error('Workspace недоступен');return{c,ws}}
 async function upload(file,{entityType='misc',entityId='',category='file'}={}){
  if(!(file instanceof Blob))throw new Error('Файл не выбран');
  const {c,ws}=assertReady();
  const originalName=file.name||'file';
  const ext=(originalName.includes('.')?'.'+originalName.split('.').pop():'').toLowerCase();
  const path=`${ws}/${clean(entityType)}/${clean(entityId||'general')}/${Date.now()}-${uid()}${ext}`;
  const {error:uploadError}=await c.storage.from(BUCKET).upload(path,file,{contentType:file.type||undefined,upsert:false,cacheControl:'3600'});
  if(uploadError)throw uploadError;
  const row={workspace_id:ws,entity_type:String(entityType||'misc'),entity_id:entityId?String(entityId):null,storage_path:path,original_name:originalName,mime_type:file.type||null,size_bytes:Number(file.size||0),category:category||null,uploaded_by:userId()||undefined};
  const {data,error}=await c.from('workspace_files').insert(row).select('*').single();
  if(error){try{await c.storage.from(BUCKET).remove([path])}catch{}throw error}
  window.dispatchEvent(new CustomEvent('fleetpilot:files-changed',{detail:{action:'upload',file:data}}));
  return data
 }
 async function list({entityType='',entityId='',category='',includeDeleted=false,limit=100}={}){
  const {c,ws}=assertReady();let q=c.from('workspace_files').select('*').eq('workspace_id',ws).order('created_at',{ascending:false}).limit(limit);
  if(entityType)q=q.eq('entity_type',entityType);if(entityId)q=q.eq('entity_id',String(entityId));if(category)q=q.eq('category',category);if(!includeDeleted)q=q.is('deleted_at',null);
  const {data,error}=await q;if(error)throw error;return data||[]
 }
 async function signedUrl(fileOrPath,expiresIn=900){const {c}=assertReady();const path=typeof fileOrPath==='string'?fileOrPath:fileOrPath?.storage_path;if(!path)throw new Error('Путь к файлу отсутствует');const {data,error}=await c.storage.from(BUCKET).createSignedUrl(path,expiresIn);if(error)throw error;return data?.signedUrl||''}
 async function open(fileOrPath){const url=await signedUrl(fileOrPath,900);if(!url)throw new Error('Не удалось открыть файл');window.open(url,'_blank','noopener,noreferrer');return url}
 async function download(fileOrPath,filename=''){const {c}=assertReady();const path=typeof fileOrPath==='string'?fileOrPath:fileOrPath?.storage_path;const name=filename||(typeof fileOrPath==='object'?fileOrPath.original_name:'')||'download';const {data,error}=await c.storage.from(BUCKET).download(path);if(error)throw error;const url=URL.createObjectURL(data);const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
 async function remove(file){if(!file?.id||!file?.storage_path)throw new Error('Файл не найден');const {c}=assertReady();const now=new Date().toISOString();const {error:metaError}=await c.from('workspace_files').update({deleted_at:now}).eq('id',file.id);if(metaError)throw metaError;const {error:storageError}=await c.storage.from(BUCKET).remove([file.storage_path]);if(storageError)console.warn('FleetPilot storage remove',storageError);window.dispatchEvent(new CustomEvent('fleetpilot:files-changed',{detail:{action:'delete',file}}));return true}
 async function replace(fileRecord,newFile,opts={}){await remove(fileRecord);return upload(newFile,{entityType:opts.entityType||fileRecord.entity_type,entityId:opts.entityId||fileRecord.entity_id,category:opts.category||fileRecord.category})}
 FP.Files={bucket:BUCKET,upload,list,signedUrl,open,download,remove,replace,workspaceId};
 window.FleetPilotFiles=FP.Files;
})();