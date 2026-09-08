
// ============== Consent Manager ==============

export class ConsentManager {
  private consents = new Map<string, Consent[]>()  // userId -> []
  private policies: PolicyVersion[] = []
  private currentVersion = '1.0.0'
