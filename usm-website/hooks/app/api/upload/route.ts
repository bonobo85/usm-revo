import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { protegerRoute } from '@/lib/apiProtection';
import { LIMITES } from '@/lib/ratelimit';
import {
  verifTexte,
  verifEntier,
  verifEnum,
  verifFichier,
  nomFichierSecurise,
  TAILLES_MAX,
  TYPES_MIME,
} from '@/lib/validation';

export const POST = protegerRoute(
  async (req: NextRequest, { session, ip }) => {
    const form = await req.formData();
    const fichier = form.get('fichier') as File;

    verifFichier(fichier, 'fichier', {
      tailleMax: TAILLES_MAX.document,
      typesAutorises: TYPES_MIME.documents,
    });

    const titre = verifTexte(form.get('titre'), 'titre', { min: 2, max: 200 });
    const description = verifTexte(form.get('description'), 'description', { max: 1000, requis: false });
    const categorie = verifEnum(form.get('categorie'), 'categorie', ['officiel', 'template', 'formation'] as const);
    const rangMin = verifEntier(form.get('rangMin'), 'rangMin', { min: 1, max: 9 });

    const admin = supabaseAdmin();
    const nomSur = nomFichierSecurise(fichier.name);
    const chemin = `${categorie}/${Date.now()}_${nomSur}`;
    const bytes = Buffer.from(await fichier.arrayBuffer());

    const { error: errUp } = await admin.storage.from('documents').upload(chemin, bytes, {
      contentType: fichier.type,
    });
    if (errUp) return NextResponse.json({ erreur: errUp.message }, { status: 500 });

    const { data: urlData } = admin.storage.from('documents').getPublicUrl(chemin);

    const { data, error: errDb } = await admin.from('documents').insert({
      titre,
      description: description || null,
      categorie,
      url: urlData.publicUrl,
      nom_fichier: nomSur,
      type_mime: fichier.type,
      taille: fichier.size,
      rank_min: rangMin,
      upload_par: session.user.id,
    }).select().single();

    if (errDb) return NextResponse.json({ erreur: errDb.message }, { status: 500 });

    // Audit
    await admin.from('audit_logs').insert({
      acteur_id: session.user.id,
      action: 'document_upload',
      cible_type: 'document',
      cible_id: data.id,
      apres: { titre, categorie, rangMin },
      ip,
    });

    return NextResponse.json({ ok: true, id: data.id });
  },
  { rangMin: 6, limite: LIMITES.upload }
);
