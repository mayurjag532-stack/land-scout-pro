import { useEffect, useRef, useState } from "react";
import { PropertyRecord } from "../types";
import { exportAllJson, exportAllCsv } from "../utils/export";
import { createFullBackup, deleteAllProperties, getStorageInfo, previewBackup, previewRestoreImpact, requestPersistentStorage, restoreBackup } from "../db";
import type { BackupPreview, RestoreImpact, StorageInfo } from "../db";
import { getPlan, setPlan, PLAN_META, Plan, isDeveloperPlanPreview } from "../entitlements";
import { BuyerProfile, clearBuyerProfile, saveBuyerProfile } from "../personalization";
import AccountAccess from "./AccountAccess";
import { StatusTag } from "./ui/StatusTag";

function fmtBytes(v:number|null){if(v===null)return "Unavailable"; if(v<1024*1024)return `${(v/1024).toFixed(1)} KB`; if(v<1024*1024*1024)return `${(v/1024/1024).toFixed(1)} MB`;return `${(v/1024/1024/1024).toFixed(2)} GB`;}
function fmtDate(v:number|null){return v?new Date(v).toLocaleString():"No full backup recorded yet";}

export default function Settings({properties,onDataChanged,buyerProfile}:{properties:PropertyRecord[];onDataChanged:()=>void;buyerProfile:BuyerProfile;}) {
  const [confirmClear,setConfirmClear]=useState(false); const [profile,setProfile]=useState<BuyerProfile>(buyerProfile); const [plan,setCurrentPlan]=useState<Plan>(()=>getPlan()); const [info,setInfo]=useState<StorageInfo|null>(null); const [message,setMessage]=useState(""); const [error,setError]=useState("");
  const [restoreFile,setRestoreFile]=useState<File|null>(null); const [preview,setPreview]=useState<BackupPreview|null>(null); const [impact,setImpact]=useState<RestoreImpact|null>(null); const [restoreMode,setRestoreMode]=useState<"merge"|"replace">("merge"); const fileRef=useRef<HTMLInputElement>(null);
  async function refreshInfo(){try{setInfo(await getStorageInfo());}catch(e){setError(e instanceof Error?e.message:"Storage information unavailable.");}}
  useEffect(()=>{refreshInfo(); const handler=(e:Event)=>setError((e as CustomEvent).detail?.message||"A storage error occurred."); window.addEventListener("plot-scout-storage-error",handler);return()=>window.removeEventListener("plot-scout-storage-error",handler);},[]);
  async function backup(){setError("");setMessage("Creating full backup…");try{const p=await createFullBackup();setMessage(`Backup created: ${p.propertyCount} properties, ${p.photoCount} photos.`);await refreshInfo();}catch(e){setMessage("");setError(e instanceof Error?e.message:"Backup failed.");}}
  async function chooseBackup(file:File|undefined){if(!file)return;setError("");setMessage("Validating backup…");try{const [p,i]=await Promise.all([previewBackup(file),previewRestoreImpact(file)]);setRestoreFile(file);setPreview(p);setImpact(i);setMessage("");}catch(e){setRestoreFile(null);setPreview(null);setImpact(null);setMessage("");setError(e instanceof Error?e.message:"Invalid backup.");}}
  async function restore(){if(!restoreFile)return;setError("");setMessage("Restoring and verifying…");try{await restoreBackup(restoreFile,restoreMode);setMessage("Restore completed and verified.");setRestoreFile(null);setPreview(null);setImpact(null);if(fileRef.current)fileRef.current.value="";await onDataChanged();await refreshInfo();}catch(e){setMessage("");setError(e instanceof Error?e.message:"Restore failed. Existing data was preserved where possible.");}}
  async function clearAll(){try{await deleteAllProperties();setConfirmClear(false);setMessage("All properties deleted. Recovery metadata is retained temporarily.");await onDataChanged();await refreshInfo();}catch(e){setError(e instanceof Error?e.message:"Delete failed.");}}
  useEffect(()=>setProfile(buyerProfile),[buyerProfile]);
  useEffect(()=>{const h=(e:Event)=>setCurrentPlan((e as CustomEvent).detail?.plan||getPlan());window.addEventListener("plot-scout-plan-change",h);return()=>window.removeEventListener("plot-scout-plan-change",h);},[]);
  function patchProfile(patch:Partial<BuyerProfile>){setProfile(v=>({...v,...patch}));}
  function saveProfile(){const next=saveBuyerProfile(profile);setProfile(next);setMessage("Personalisation saved. New visits will use these criteria automatically.");}
  function resetProfile(){const next=clearBuyerProfile();setProfile(next);setMessage("Personalisation profile cleared.");}
  async function persist(){const ok=await requestPersistentStorage();setMessage(ok===true?"Persistent storage granted by this browser.":ok===false?"Browser did not grant persistent storage. Keep regular backups.":"Persistent storage is not supported here.");await refreshInfo();}

  return <div className="px-4 py-4 max-w-xl mx-auto pb-24 md:pb-10 space-y-4">
    <div><p className="text-[11px] uppercase tracking-[.18em] text-field-muted mb-1">Device & privacy</p><h2 className="text-field-text text-2xl font-semibold tracking-tight">Settings</h2></div>
    {(message||error)&&<div className={`rounded-xl p-3 text-sm border ${error?"border-field-bad/50 text-field-bad bg-field-card":"border-field-accent/50 text-field-accent bg-field-card"}`}>{error||message}</div>}

    <AccountAccess/>

    <div className="personalisation-card">
      <div className="personalisation-head"><div><p className="ps-kicker">Saved context</p><h3>Personalisation</h3><p>Tell Plot Scout your buying criteria once. Turn it off anytime to use the neutral V3.2 workflow.</p></div><button type="button" aria-pressed={profile.enabled} onClick={()=>{const next=saveBuyerProfile({...profile,enabled:!profile.enabled});setProfile(next)}} className={`profile-switch ${profile.enabled?"on":""}`}><span/>{profile.enabled?"ON":"OFF"}</button></div>
      <div className={`profile-form ${profile.enabled?"":"muted"}`}>
        <label>Profile name<input value={profile.name} onChange={e=>patchProfile({name:e.target.value})} placeholder="My Land Criteria"/></label>
        <div className="profile-grid"><label>Budget min ₹<input type="number" value={profile.budgetMin??""} onChange={e=>patchProfile({budgetMin:e.target.value?Number(e.target.value):null})}/></label><label>Budget max ₹<input type="number" value={profile.budgetMax??""} onChange={e=>patchProfile({budgetMax:e.target.value?Number(e.target.value):null})}/></label></div>
        <label>Preferred locations<input value={profile.preferredLocations} onChange={e=>patchProfile({preferredLocations:e.target.value})} placeholder="e.g. Saswad Road, Hadapsar"/><small>Separate multiple areas with commas.</small></label>
        <div className="profile-grid"><label>Min area · guntha<input type="number" step="0.1" value={profile.minAreaGuntha??""} onChange={e=>patchProfile({minAreaGuntha:e.target.value?Number(e.target.value):null})}/></label><label>Max area · guntha<input type="number" step="0.1" value={profile.maxAreaGuntha??""} onChange={e=>patchProfile({maxAreaGuntha:e.target.value?Number(e.target.value):null})}/></label></div>
        <label>Intended use<select value={profile.intendedUse} onChange={e=>patchProfile({intendedUse:e.target.value as BuyerProfile["intendedUse"]})}><option value="INVESTMENT">Investment</option><option value="HOME">Home</option><option value="FARM">Farm</option><option value="COMMERCIAL">Commercial</option><option value="OTHER">Other</option></select></label>
        <div className="profile-grid"><label>Highway requirement<select value={profile.highwayRequirement} onChange={e=>patchProfile({highwayRequirement:e.target.value as BuyerProfile["highwayRequirement"]})}><option value="IGNORE">Doesn’t matter</option><option value="PREFERRED">Preferred</option><option value="MANDATORY">Mandatory</option></select></label><label>Max highway distance · m<input type="number" value={profile.maxHighwayDistanceM??""} onChange={e=>patchProfile({maxHighwayDistanceM:e.target.value?Number(e.target.value):null})} placeholder="e.g. 100"/></label></div>
        <div className="profile-grid"><label>Vehicle access<select value={profile.carAccessRequirement} onChange={e=>patchProfile({carAccessRequirement:e.target.value as BuyerProfile["carAccessRequirement"]})}><option value="IGNORE">Doesn’t matter</option><option value="PREFERRED">Preferred</option><option value="MANDATORY">Mandatory</option></select></label><label>Minimum road width · ft<input type="number" value={profile.minRoadWidthFt??""} onChange={e=>patchProfile({minRoadWidthFt:e.target.value?Number(e.target.value):null})}/></label></div>
        <label>Risk tolerance<select value={profile.riskTolerance} onChange={e=>patchProfile({riskTolerance:e.target.value as BuyerProfile["riskTolerance"]})}><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option></select></label>
        <label>What matters most<textarea rows={2} value={profile.priorities} onChange={e=>patchProfile({priorities:e.target.value})} placeholder="e.g. future appreciation, quiet area, wide frontage"/></label>
        <label>Absolute deal-breakers<textarea rows={2} value={profile.dealBreakers} onChange={e=>patchProfile({dealBreakers:e.target.value})} placeholder="e.g. no clear access, nala nearby"/></label>
        <p className="profile-note">Blank fields are ignored. Saved preferences guide Buyer Fit; they never rewrite objective property facts or legal verification.</p>
        <div className="profile-actions"><button onClick={saveProfile}>Save criteria</button><button className="secondary" onClick={resetProfile}>Clear profile</button></div>
      </div>
    </div>

    <div className="bg-field-card border border-field-line rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-3"><div><p className="text-field-text font-semibold">Product access</p><p className="text-field-muted text-xs mt-1">One app, with capabilities controlled by an entitlement layer.</p></div><span className="tier-lock">{PLAN_META[plan].name}</span></div>
      {isDeveloperPlanPreview()?<><div className="grid grid-cols-3 gap-2">{(["BASIC","ADVANCED","PRO"] as Plan[]).map(x=><button key={x} onClick={()=>{setPlan(x);setCurrentPlan(x)}} className={`rounded-lg border px-2 py-2 text-xs font-medium flex items-center justify-center gap-1.5 ${plan===x?"border-field-accent bg-field-accent/10 text-field-accent":"border-field-line bg-field-panel text-field-muted"}`}>{plan===x&&<span className="w-1.5 h-1.5 rounded-full bg-field-accent"/>}{PLAN_META[x].name}</button>)}</div><p className="text-field-muted text-[11px]">Developer preview only — local plan switching is disabled in production.</p></>:<p className="text-field-muted text-[11px] border border-field-line bg-field-panel rounded-lg p-3">Production access is read-only here and is granted only by verified server-side purchase entitlement. If verification is unavailable, access fails closed to Basic.</p>}
      <div className="grid grid-cols-1 gap-1.5 text-xs"><p className="text-field-muted"><span className="text-field-text">Basic</span> · visits, GPS, checklist, pricing, photos, local data safety</p><p className="text-field-muted"><span className="text-field-text">Advanced</span> · adds map intelligence and deeper decision workflow</p><p className="text-field-muted"><span className="text-field-text">Pro</span> · adds portfolio comparison and professional reporting</p></div>
      <p className="text-field-muted text-[11px] border-t border-field-line pt-2">Backups, restore and privacy controls remain available regardless of plan. Data safety is never paywalled.</p>
    </div>

    <div className="bg-field-card border border-field-line rounded-xl p-4 space-y-2">
      <div className="flex items-center justify-between gap-3"><p className="text-field-text font-semibold">Privacy & Data</p><span className="text-[10px] uppercase tracking-[.12em] text-field-accent border border-field-accent/30 rounded-full px-2 py-1">Local-first</span></div>
      <p className="text-field-muted text-xs">Your property data is stored on this device by default. Plot Scout does not automatically upload your property records, photos or documents.</p>
      <div className="grid grid-cols-2 gap-2 pt-1">
        <div className="bg-field-panel rounded-lg p-2.5"><p className="text-field-muted text-[10px] uppercase tracking-[.06em]">Properties</p><p className="text-field-text text-lg font-bold tabular-nums mt-0.5">{info?.propertyCount ?? properties.length}</p></div>
        <div className="bg-field-panel rounded-lg p-2.5"><p className="text-field-muted text-[10px] uppercase tracking-[.06em]">Photos</p><p className="text-field-text text-lg font-bold tabular-nums mt-0.5">{info?.photoCount ?? "—"}</p></div>
        <div className="bg-field-panel rounded-lg p-2.5"><p className="text-field-muted text-[10px] uppercase tracking-[.06em]">Storage used</p><p className="text-field-text text-sm font-semibold tabular-nums mt-0.5">{fmtBytes(info?.usage ?? null)}</p></div>
        <div className="bg-field-panel rounded-lg p-2.5"><p className="text-field-muted text-[10px] uppercase tracking-[.06em]">Site quota</p><p className="text-field-text text-sm font-semibold tabular-nums mt-0.5">{fmtBytes(info?.quota ?? null)}</p></div>
        <div className="bg-field-panel rounded-lg p-2.5"><p className="text-field-muted text-[10px] uppercase tracking-[.06em]">Recovery points</p><p className="text-field-text text-sm font-semibold tabular-nums mt-0.5">{info?.recoveryCount ?? "—"}</p></div>
        <div className="bg-field-panel rounded-lg p-2.5"><p className="text-field-muted text-[10px] uppercase tracking-[.06em]">Persistent storage</p><div className="mt-1"><StatusTag tone={info?.persisted===true?"good":info?.persisted===false?"bad":"neutral"} label={info?.persisted===true?"Granted":info?.persisted===false?"Not granted":"Unavailable"} /></div></div>
      </div>
      <p className="text-sm text-field-muted pt-1">Last full backup: <span className="text-field-text">{fmtDate(info?.lastBackupAt ?? null)}</span>{info?.latestRecoveryAt ? <span className="text-field-muted"> · latest recovery {fmtDate(info.latestRecoveryAt)}</span> : null}</p>
      {info?.persisted===false&&<button onClick={persist} className="w-full bg-field-panel border border-field-accent text-field-accent rounded-lg py-2.5 text-sm font-medium">Request persistent storage</button>}
      <p className="text-field-muted text-[11px]">Storage limits are controlled by your browser/device. Persistent storage can reduce automatic cleanup risk, but it is not a substitute for backup.</p>
    </div>

    <div className="bg-field-card border border-field-line rounded-xl p-4 space-y-3">
      <div><p className="text-field-text font-semibold">Full Backup</p><p className="text-field-muted text-xs mt-1">Includes properties, photos, notes, map results, checklist, prices and statuses in one integrity-checked Plot Scout backup.</p></div>
      <button onClick={backup} className="w-full bg-field-panel border border-field-accent text-field-accent rounded-lg py-2.5 text-sm font-medium">Create Full Backup</button>
      <div className="border-t border-field-line pt-3"><p className="text-field-text font-semibold text-sm mb-2">Restore Backup</p>
        <input ref={fileRef} type="file" accept=".plotscout,application/json" onChange={e=>chooseBackup(e.target.files?.[0])} className="block w-full text-xs text-field-muted" />
        {preview&&<div className="mt-3 bg-field-panel rounded-lg p-3 text-xs text-field-muted space-y-1"><p className="text-field-text font-medium">Valid Plot Scout backup ✓</p><p>{new Date(preview.createdAt).toLocaleString()}</p><p>{preview.propertyCount} properties · {preview.photoCount} photos · format v{preview.formatVersion}</p>
          <div className="flex gap-2 pt-2"><button onClick={()=>setRestoreMode("merge")} className={`px-3 py-1.5 rounded border ${restoreMode==="merge"?"border-field-accent text-field-accent":"border-field-line"}`}>Merge</button><button onClick={()=>setRestoreMode("replace")} className={`px-3 py-1.5 rounded border ${restoreMode==="replace"?"border-field-bad text-field-bad":"border-field-line"}`}>Replace all</button></div>
          <p className="pt-1">{restoreMode==="merge"?"Merge keeps current records and uses the newer version when IDs match.":"Replace removes current properties after validation. A local safety recovery point is created first."}</p>
          {impact&&restoreMode==="merge"&&<div className="mt-2 rounded-lg border border-field-line p-2 space-y-1"><p className="text-field-text font-medium">Merge preview</p><p>Current: {impact.currentCount} · Backup: {impact.backupCount}</p><p>Add new: {impact.addCount} · Update matching: {impact.updateCount} · Keep newer current: {impact.unchangedCount}</p><p className="text-field-accent font-medium">Expected after merge: {impact.finalMergeCount} properties</p>{impact.addCount>0&&<p className="text-field-muted">A higher total is expected because the backup contains {impact.addCount} record{impact.addCount===1?"":"s"} with a different internal ID. This is not a duplicate created by restore.</p>}</div>}
          {impact&&restoreMode==="replace"&&<div className="mt-2 rounded-lg border border-field-bad/30 p-2"><p className="text-field-text font-medium">Replace preview</p><p>Current {impact.currentCount} properties will be replaced by {impact.backupCount} backup properties.</p></div>}
          <button onClick={restore} className="w-full mt-2 bg-field-accent text-field-bg rounded-lg py-2 font-semibold">Confirm Restore</button>
        </div>}
      </div>
    </div>

    <div className="bg-field-card border border-field-line rounded-xl p-4"><p className="text-field-text font-semibold mb-2">Portable Exports</p><div className="flex flex-col gap-2"><button onClick={()=>exportAllJson(properties)} className="bg-field-panel border border-field-accent text-field-accent rounded-lg py-2.5 text-sm font-medium">Export all as JSON</button><button onClick={()=>plan==="PRO"?exportAllCsv(properties):setMessage("Portfolio CSV is available on Plot Scout Pro. Full Backup remains available on every plan.")} className="bg-field-panel border border-field-accent text-field-accent rounded-lg py-2.5 text-sm font-medium">Export all as CSV{plan!=="PRO"?" · Pro":""}</button></div><p className="text-field-muted text-[11px] mt-2">Use Full Backup for complete recovery. CSV is intended for analysis and does not contain photo files.</p></div>

    <div className="bg-field-card border border-field-bad/40 rounded-xl p-4"><p className="text-field-bad font-semibold mb-2">Danger zone</p>{!confirmClear?<button onClick={()=>setConfirmClear(true)} className="text-field-bad text-sm border border-field-bad/50 rounded-lg px-4 py-2">Delete all saved properties</button>:<div><p className="text-field-text text-sm mb-2">This removes all {properties.length} properties and their photos. Create a Full Backup first if you may need them later.</p><div className="flex gap-2"><button onClick={clearAll} className="bg-field-bad text-field-bg rounded-lg px-4 py-2 text-sm font-semibold">Yes, delete everything</button><button onClick={()=>setConfirmClear(false)} className="bg-field-panel text-field-text rounded-lg px-4 py-2 text-sm">Cancel</button></div></div>}</div>
    <div className="bg-field-panel border border-field-line rounded-xl p-4"><p className="text-field-muted text-[11px]">Map data is an indicator only. Ownership, title, zoning, NA status, legal access and permissions must be independently verified.</p></div>
  </div>;
}
