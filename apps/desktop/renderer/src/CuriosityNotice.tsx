import { useCuriosity } from './useCuriosity';
export function CuriosityNotice() {
  const {snapshot}=useCuriosity();
  const latest=snapshot?.explorations.find(item=>item.status==='succeeded' && item.unread);
  if(!latest)return null;
  const discovery=snapshot?.items.find(item=>item.explorationId===latest.id&&item.kind==='discovery');
  return <aside className="curiosity-notice" aria-label="Découverte à partager"><p>Une réflexion locale est prête à partager.</p><span>{snapshot?.interests.find(item=>item.id===latest.interestId)?.title}</span><details aria-label="Détail de la réflexion"><summary>Pourquoi cette piste ?</summary><p><strong>Pourquoi :</strong> {latest.reason}</p>{discovery && <p><strong>Résultat proposé :</strong> {discovery.content}</p>}{latest.nextQuestion && <p><strong>Ensuite :</strong> {latest.nextQuestion}</p>}{discovery?.limits && <small>{discovery.limits}</small>}</details><button className="text-button" onClick={()=>{void window.aether.command('curiosity');}}>Lire mon journal</button><small>Synthèse du modèle, sans vérification externe.</small></aside>;
}
