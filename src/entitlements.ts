import { backendConfigured, runtimeConfig } from "./services/config";
import { getSession } from "./services/auth";
import { getServerEntitlements, ServerEntitlement } from "./services/entitlementServer";

export type Plan = "BASIC" | "ADVANCED" | "PRO";
export type Feature = "map_intelligence" | "portfolio_compare" | "professional_report" | "portfolio_csv" | "advanced_decision";
export const PLAN_META: Record<Plan,{name:string;tagline:string}> = { BASIC:{name:"Basic",tagline:"Capture and organise field visits"}, ADVANCED:{name:"Advanced",tagline:"Add map and decision intelligence"}, PRO:{name:"Pro",tagline:"Full evaluation and comparison workflow"} };
const ACCESS: Record<Feature,Plan[]> = { map_intelligence:["ADVANCED","PRO"], advanced_decision:["ADVANCED","PRO"], portfolio_compare:["PRO"], professional_report:["PRO"], portfolio_csv:["PRO"] };
const KEY="plot-scout:plan-preview";
const isDevPreview = import.meta.env.DEV && runtimeConfig.appEnv !== "production";
let trustedPlan:Plan = isDevPreview ? readPreview() : "BASIC";
let trustedEntitlements:ServerEntitlement[]=[];
function readPreview():Plan{const v=localStorage.getItem(KEY);return v==="BASIC"||v==="ADVANCED"||v==="PRO"?v:"PRO";}
function emit(){window.dispatchEvent(new CustomEvent("plot-scout-plan-change",{detail:{plan:trustedPlan}}));}
export function isDeveloperPlanPreview(){return isDevPreview;}
export function getPlan():Plan{return isDevPreview?readPreview():trustedPlan;}
export function setPlan(plan:Plan){if(!isDevPreview)return;localStorage.setItem(KEY,plan);trustedPlan=plan;emit();}
export function canUse(plan:Plan,feature:Feature){if(!isDevPreview && feature==="professional_report" && trustedEntitlements.some(e=>e.product_code==="report_single")) return true;return ACCESS[feature].includes(plan);}
export function requiredPlan(feature:Feature):Plan{return ACCESS[feature][0];}
/**
 * Returns the authenticated user's email as verified by the Supabase auth
 * server. The localStorage session is client-tamperable and must NOT be
 * trusted for identity — this endpoint validates the JWT server-side and
 * returns the real account email. Returns "" if the token is invalid.
 */
async function getVerifiedEmail():Promise<string>{
  const s=getSession();
  if(!s||!backendConfigured)return "";
  try{
    const r=await fetch(`${runtimeConfig.supabaseUrl}/auth/v1/user`,{
      headers:{apikey:runtimeConfig.supabaseAnonKey,Authorization:`Bearer ${s.access_token}`}
    });
    if(!r.ok)return "";
    const user=await r.json();
    return (user?.email||"").toLowerCase();
  }catch{return "";}
}
export async function syncTrustedEntitlements():Promise<Plan>{
  if(isDevPreview){trustedPlan=readPreview();emit();return trustedPlan;}
  trustedPlan="BASIC";trustedEntitlements=[];
  if(!backendConfigured||!getSession()){emit();return trustedPlan;}
  try{
    trustedEntitlements=await getServerEntitlements();
    trustedPlan=trustedEntitlements.some(e=>e.product_code==="investor_annual")?"PRO":"BASIC";
    /* Owner/test accounts: the SERVER-VERIFIED session email is checked against
       the VITE_OWNER_EMAILS allowlist (public env config, not a secret — the
       security comes from Supabase validating the token, not from hiding the
       address). Grants the real PRO tier through the standard machinery;
       customer rules and checks are unchanged. */
    if(trustedPlan!=="PRO"){
      const email=await getVerifiedEmail();
      if(email&&runtimeConfig.ownerEmails.includes(email))trustedPlan="PRO";
    }
  }catch{trustedPlan="BASIC";trustedEntitlements=[];}
  emit();return trustedPlan;
}
