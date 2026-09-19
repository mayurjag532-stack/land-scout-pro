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
export async function syncTrustedEntitlements():Promise<Plan>{
  if(isDevPreview){trustedPlan=readPreview();emit();return trustedPlan;}
  trustedPlan="BASIC";trustedEntitlements=[];
  if(!backendConfigured||!getSession()){emit();return trustedPlan;}
  try{trustedEntitlements=await getServerEntitlements();trustedPlan=trustedEntitlements.some(e=>e.product_code==="investor_annual")?"PRO":"BASIC";}catch{trustedPlan="BASIC";trustedEntitlements=[];}
  emit();return trustedPlan;
}
