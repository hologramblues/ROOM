import { useCallback } from 'react';
import { SERVER_URL } from '../constants/config';
import { stripHtml } from '../utils/helpers';

export default function useAIRewrite({
  token, aiRewriteSelection, aiRewriteTone, elementsRef,
  setAiRewriteResult, setAiRewriteLoading,
  setShowAIRewrite, setAiRewriteSelection, setAiRewriteMode,
  updateElement
}) {
  const handleAIRewrite = useCallback(async (mode, customPrompt = '') => {
    if (!aiRewriteSelection) return;

    setAiRewriteLoading(true);
    setAiRewriteResult(null);

    const { text } = aiRewriteSelection;

    let systemPrompt = "Tu es un assistant d'écriture de scénario professionnel. Tu aides les scénaristes à améliorer leur texte. Réponds UNIQUEMENT avec le texte réécrit, sans explication ni commentaire.";
    let userPrompt = '';

    switch (mode) {
      case 'concis':
        userPrompt = `Réécris ce texte de manière plus concise et directe, en gardant l'essence mais en éliminant les mots superflus :\n\n"${text}"`;
        break;
      case 'develop':
        userPrompt = `Développe et enrichis ce texte avec plus de détails et de nuances, tout en gardant le style scénaristique :\n\n"${text}"`;
        break;
      case 'reformulate':
        userPrompt = `Reformule ce texte différemment tout en gardant exactement le même sens. Propose une formulation alternative :\n\n"${text}"`;
        break;
      case 'tone':
        userPrompt = `Réécris ce texte avec un ton plus ${aiRewriteTone} :\n\n"${text}"`;
        break;
      case 'custom':
        userPrompt = `${customPrompt}\n\nTexte à modifier :\n"${text}"`;
        break;
      default:
        userPrompt = `Améliore ce texte :\n\n"${text}"`;
    }

    try {
      const res = await fetch(SERVER_URL + '/api/ai/rewrite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? 'Bearer ' + token : ''
        },
        body: JSON.stringify({
          systemPrompt,
          userPrompt,
          originalText: text
        })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Erreur API');
      }

      const data = await res.json();
      setAiRewriteResult(data.rewrittenText);
    } catch (err) {
      console.error('AI Rewrite error:', err);
      setAiRewriteResult('\u274c Erreur: ' + err.message);
    } finally {
      setAiRewriteLoading(false);
    }
  }, [aiRewriteSelection, aiRewriteTone, token, setAiRewriteLoading, setAiRewriteResult]);

  const applyAIRewrite = useCallback((aiRewriteResult) => {
    if (!aiRewriteResult || !aiRewriteSelection) return;

    const { elementIndex, startOffset, endOffset } = aiRewriteSelection;
    const element = elementsRef.current[elementIndex];
    if (!element) return;

    const plain = stripHtml(element.content);
    const before = plain.substring(0, startOffset);
    const after = plain.substring(endOffset);
    const newContent = before + aiRewriteResult + after;

    updateElement(elementIndex, newContent);

    setShowAIRewrite(false);
    setAiRewriteSelection(null);
    setAiRewriteResult(null);
    setAiRewriteMode(null);
  }, [aiRewriteSelection, elementsRef, updateElement, setShowAIRewrite, setAiRewriteSelection, setAiRewriteResult, setAiRewriteMode]);

  return { handleAIRewrite, applyAIRewrite };
}
