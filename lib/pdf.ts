'use client';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function enteteUSM(doc: jsPDF, titre: string) {
  // Étoile stylisée (cercle doré simple)
  // Cercle or/bronze USM
  doc.setFillColor(166, 124, 78); // #A67C4E
  doc.circle(20, 20, 10, 'F');
  doc.setTextColor(245, 243, 236); // blanc cassé
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('USM', 20, 22, { align: 'center' });

  // Titre bleu marine USM
  doc.setTextColor(27, 62, 124); // #1B3E7C
  doc.setFontSize(18);
  doc.text('United States Marshal', 35, 18);
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(titre, 35, 26);

  // Ligne séparatrice or/bronze USM
  doc.setDrawColor(166, 124, 78); // #A67C4E
  doc.setLineWidth(0.8);
  doc.line(15, 35, 195, 35);

  doc.setTextColor(0, 0, 0);
}

function piedPage(doc: jsPDF) {
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`USM — Document officiel — Page ${i}/${pages}`, 105, 290, { align: 'center' });
  }
}

export function genererFichePresence(session: any, participants: any[]) {
  const doc = new jsPDF();
  enteteUSM(doc, "Fiche de présence — Entraînement");

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(session.titre, 15, 50);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Date : ${new Date(session.date_session).toLocaleString('fr-FR')}`, 15, 58);
  if (session.lieu) doc.text(`Lieu : ${session.lieu}`, 15, 64);

  autoTable(doc, {
    startY: 75,
    head: [['#', 'Membre', 'Présent', 'Score', 'Commentaire']],
    body: participants.map((p, i) => [
      i + 1,
      p.user?.username || '-',
      p.present ? '✓' : '✗',
      p.score ?? '-',
      p.commentaire || '-',
    ]),
    headStyles: { fillColor: [27, 62, 124], textColor: 245 },
  });

  piedPage(doc);
  doc.save(`fiche-presence-${session.titre.replace(/\s+/g, '-')}.pdf`);
}

export function genererResultatEvaluation(evaluation: any, reponses: any[]) {
  const doc = new jsPDF();
  enteteUSM(doc, "Résultat d'évaluation");

  doc.setFontSize(11);
  doc.text(`Candidat : ${evaluation.candidat?.username}`, 15, 50);
  doc.text(`Formateur : ${evaluation.formateur?.username}`, 15, 57);
  doc.text(`Questionnaire : ${evaluation.questionnaire?.titre}`, 15, 64);
  doc.text(`Statut : ${evaluation.statut}`, 15, 71);
  doc.text(`Score : ${evaluation.score_obtenu ?? '-'} / ${evaluation.score_total ?? '-'}`, 15, 78);

  autoTable(doc, {
    startY: 90,
    head: [['Question', 'Réponse', 'Correct', 'Points']],
    body: reponses.map((r) => [
      r.question?.question || '-',
      r.reponse || '-',
      r.correcte ? '✓' : '✗',
      r.points_obtenus,
    ]),
    headStyles: { fillColor: [27, 62, 124], textColor: 245 },
  });

  piedPage(doc);
  doc.save(`evaluation-${evaluation.candidat?.username}.pdf`);
}

export function genererRapport(rapport: any) {
  const doc = new jsPDF();
  enteteUSM(doc, `Rapport ${rapport.type.toUpperCase()}`);

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(rapport.titre, 15, 50);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Auteur : ${rapport.auteur?.username}`, 15, 60);
  doc.text(`Date : ${new Date(rapport.created_at).toLocaleString('fr-FR')}`, 15, 66);
  doc.text(`Statut : ${rapport.statut}`, 15, 72);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Contenu :', 15, 84);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const texte = rapport.contenu?.texte || '';
  const lignes = doc.splitTextToSize(texte, 180);
  doc.text(lignes, 15, 92);

  if (rapport.commentaire_validation) {
    const y = Math.min(92 + lignes.length * 5 + 10, 260);
    doc.setFont('helvetica', 'bold');
    doc.text('Commentaire de validation :', 15, y);
    doc.setFont('helvetica', 'normal');
    const lig = doc.splitTextToSize(rapport.commentaire_validation, 180);
    doc.text(lig, 15, y + 6);
  }

  piedPage(doc);
  doc.save(`rapport-${rapport.titre.replace(/\s+/g, '-')}.pdf`);
}
