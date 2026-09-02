import { execFileSync } from "node:child_process";

// Committa e pusha subito un file generato a runtime (es. l'immagine della
// storia), perché l'API di Instagram richiede un URL pubblico raggiungibile
// per il contenuto multimediale: il repo pubblico + raw.githubusercontent.com
// fa da hosting immagini senza bisogno di un servizio esterno.
export function commitAndPush(filePaths, message) {
  const paths = Array.isArray(filePaths) ? filePaths : [filePaths];
  execFileSync("git", ["add", ...paths], { stdio: "inherit" });
  try {
    execFileSync("git", ["commit", "-m", message], { stdio: "inherit" });
  } catch {
    return; // niente da committare (contenuto identico al precedente)
  }
  execFileSync("git", ["push"], { stdio: "inherit" });
}
