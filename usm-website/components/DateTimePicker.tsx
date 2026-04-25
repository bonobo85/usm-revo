'use client';

import { useEffect, useRef, useState } from 'react';
import { Calendar as CalIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * DateTimePicker style iOS — 3 colonnes (jour / mois / année) + (heure / minute) en mode "wheel".
 * - value : ISO string (ou '' )
 * - onChange : reçoit ISO string
 */
type Props = {
  value: string;
  onChange: (iso: string) => void;
  className?: string;
  minutesStep?: number; // par défaut 5
};

const MOIS_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

function pad(n: number) { return n.toString().padStart(2, '0'); }

export function DateTimePicker({ value, onChange, className, minutesStep = 5 }: Props) {
  const [ouvert, setOuvert] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const init = value ? new Date(value) : nextRoundedNow(minutesStep);

  const [annee, setAnnee] = useState(init.getFullYear());
  const [mois, setMois] = useState(init.getMonth());
  const [jour, setJour] = useState(init.getDate());
  const [heure, setHeure] = useState(init.getHours());
  const [minute, setMinute] = useState(roundMin(init.getMinutes(), minutesStep));

  useEffect(() => {
    function clic(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOuvert(false);
    }
    if (ouvert) document.addEventListener('mousedown', clic);
    return () => document.removeEventListener('mousedown', clic);
  }, [ouvert]);

  function valider() {
    const d = new Date(annee, mois, Math.min(jour, joursDansMois(annee, mois)), heure, minute);
    onChange(d.toISOString());
    setOuvert(false);
  }

  const aff = value
    ? new Date(value).toLocaleDateString('fr-FR', {
        weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : 'Sélectionner une date…';

  const annees = range(new Date().getFullYear() - 1, new Date().getFullYear() + 5);
  const jours = range(1, joursDansMois(annee, mois));
  const heures = range(0, 23);
  const minutes = range(0, 59).filter((m) => m % minutesStep === 0);

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        className="input flex items-center gap-2 text-left"
      >
        <CalIcon size={16} className="text-texte-gris" />
        <span className={value ? 'text-white' : 'text-texte-gris'}>{aff}</span>
      </button>

      {ouvert && (
        <div className="absolute left-0 top-full mt-2 z-50 bg-fond-carte border border-gris-bordure rounded-xl shadow-2xl p-4 w-[420px] max-w-[95vw]">
          <div className="text-xs uppercase tracking-wider text-texte-gris mb-2">Date</div>
          <div className="grid grid-cols-3 gap-2 mb-4">
            <Wheel valeurs={jours} valeur={jour} onChange={setJour} format={(v) => pad(v)} />
            <Wheel valeurs={range(0, 11)} valeur={mois} onChange={setMois} format={(v) => MOIS_FR[v].slice(0, 4)} />
            <Wheel valeurs={annees} valeur={annee} onChange={setAnnee} format={(v) => v.toString()} />
          </div>

          <div className="text-xs uppercase tracking-wider text-texte-gris mb-2">Heure</div>
          <div className="grid grid-cols-2 gap-2 mb-4">
            <Wheel valeurs={heures} valeur={heure} onChange={setHeure} format={(v) => pad(v) + 'h'} />
            <Wheel valeurs={minutes} valeur={minute} onChange={setMinute} format={(v) => pad(v)} />
          </div>

          <div className="flex gap-2">
            <button type="button" onClick={() => setOuvert(false)} className="flex-1 input">Annuler</button>
            <button type="button" onClick={valider} className="flex-1 bouton-bleu">Valider</button>
          </div>
        </div>
      )}
    </div>
  );
}

const ITEM_H = 36; // px

function Wheel<T extends number>({
  valeurs,
  valeur,
  onChange,
  format,
}: {
  valeurs: T[];
  valeur: T;
  onChange: (v: T) => void;
  format: (v: T) => string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const idx = Math.max(0, valeurs.indexOf(valeur));

  // Synchronise scroll quand la valeur change de l'extérieur
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = idx * ITEM_H;
  }, [idx]);

  function onScroll() {
    if (!ref.current) return;
    const i = Math.round(ref.current.scrollTop / ITEM_H);
    const clamped = Math.max(0, Math.min(valeurs.length - 1, i));
    if (valeurs[clamped] !== valeur) onChange(valeurs[clamped]);
  }

  // Snap à l'arrêt du scroll (touch + souris)
  const tmo = useRef<number | null>(null);
  function onScrollSnap() {
    onScroll();
    if (tmo.current) window.clearTimeout(tmo.current);
    tmo.current = window.setTimeout(() => {
      if (!ref.current) return;
      const i = Math.round(ref.current.scrollTop / ITEM_H);
      ref.current.scrollTo({ top: i * ITEM_H, behavior: 'smooth' });
    }, 120);
  }

  return (
    <div className="relative h-[180px] bg-fond-clair rounded-lg overflow-hidden border border-gris-bordure">
      {/* bandeau central */}
      <div
        className="pointer-events-none absolute left-0 right-0 border-y border-bleu/40 bg-bleu/5"
        style={{ top: ITEM_H * 2, height: ITEM_H }}
      />
      <div
        ref={ref}
        onScroll={onScrollSnap}
        className="h-full overflow-y-scroll snap-y snap-mandatory scrollbar-none"
        style={{ scrollSnapType: 'y mandatory', paddingTop: ITEM_H * 2, paddingBottom: ITEM_H * 2 }}
      >
        {valeurs.map((v, i) => (
          <div
            key={String(v) + i}
            onClick={() => {
              onChange(v);
              if (ref.current) ref.current.scrollTo({ top: i * ITEM_H, behavior: 'smooth' });
            }}
            className={cn(
              'snap-center flex items-center justify-center text-sm cursor-pointer transition-colors',
              v === valeur ? 'text-white font-semibold' : 'text-texte-gris hover:text-white',
            )}
            style={{ height: ITEM_H }}
          >
            {format(v)}
          </div>
        ))}
      </div>
    </div>
  );
}

function joursDansMois(annee: number, mois: number) {
  return new Date(annee, mois + 1, 0).getDate();
}
function range(a: number, b: number): number[] {
  const r: number[] = [];
  for (let i = a; i <= b; i++) r.push(i);
  return r;
}
function roundMin(m: number, step: number) {
  return Math.round(m / step) * step % 60;
}
function nextRoundedNow(step: number) {
  const d = new Date();
  d.setMinutes(roundMin(d.getMinutes(), step), 0, 0);
  return d;
}
