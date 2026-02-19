import React, { useState, useRef, useEffect, useCallback, useMemo, createContext, lazy, Suspense } from 'react';
import { io } from 'socket.io-client';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Mark, Node, Extension, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

// V237 - Smooth scroll: CSS content-visibility instead of React virtualization

// V272: Import screenplay editor CSS styles (single TipTap)
import './App.css';

// Import Excalidraw CSS
import '@excalidraw/excalidraw/index.css';

// Lazy load Excalidraw (it's a big package)
const Excalidraw = lazy(() => 
  import('@excalidraw/excalidraw').then(module => ({ default: module.Excalidraw }))
);

// ============ DESKTOP DETECTION ============
const IS_DESKTOP = !!(window.electronAPI?.isDesktop);
let SERVER_URL = 'https://room-production-19a5.up.railway.app';

// ============ TRANSLATIONS ============
const translations = {
  fr: {
    // Landing page
    tagline: "L'éditeur de scénario collaboratif en temps réel",
    login: "Se connecter / S'inscrire",
    continueWithoutAccount: "Continuer sans compte",
    noAccountWarning: "Sans compte, vos documents ne seront pas sauvegardés",
    
    // Auth modal
    connection: "Connexion",
    registration: "Inscription",
    email: "Email",
    password: "Mot de passe",
    name: "Nom",
    signingIn: "Connexion...",
    registering: "Inscription...",
    signIn: "Se connecter",
    register: "S'inscrire",
    noAccount: "Pas de compte ?",
    createOne: "Créer un compte",
    alreadyAccount: "Déjà un compte ?",
    
    // Menu Document
    document: "Document",
    new: "Nouveau",
    myDocuments: "Mes documents",
    snapshot: "Snapshot",
    history: "Historique",
    import: "Importer",
    export: "Exporter",
    
    // Menu Outils
    tools: "Outils",
    search: "Rechercher",
    renameCharacter: "Renommer personnage",
    characters: "Personnages",
    statistics: "Statistiques",
    goToScene: "Aller à la scène",
    sceneNumbers: "Numéros de scènes",
    chatNotifications: "Notifications chat",
    shortcuts: "Raccourcis",
    language: "Langue",
    
    // Element types
    scene: "Séquence",
    action: "Action",
    character: "Personnage",
    dialogue: "Dialogue",
    parenthetical: "Didascalie",
    transition: "Transition",
    note: "Note",
    
    // Outline
    outline: "Outline",
    status: "Statut",
    assigned: "Assigné",
    all: "Tous",
    inProgress: "En cours",
    validated: "Validé",
    urgent: "Urgent",
    noStatus: "Sans statut",
    unassigned: "Non assigné",
    none: "Aucun",
    assignTo: "Assigner à",
    lock: "Verrouiller",
    unlock: "Déverrouiller",
    
    // Comments sidebar
    comments: "Commentaires",
    suggestions: "Suggestions",
    addComment: "Ajouter un commentaire",
    reply: "Répondre",
    resolve: "Résoudre",
    delete: "Supprimer",
    accept: "Accepter",
    reject: "Rejeter",
    cancel: "Annuler",
    send: "Envoyer",
    edit: "Modifier",
    writeComment: "Écrire un commentaire...",
    suggestReplacement: "Suggérer un remplacement...",
    
    // Search & Replace
    searchReplace: "Rechercher / Remplacer",
    replaceWith: "Remplacer par",
    replace: "Remplacer",
    replaceAll: "Tout",
    noResults: "Aucun résultat",
    
    // Statistics
    statsTitle: "Statistiques du scénario",
    totalScenes: "Total séquences",
    totalPages: "Pages estimées",
    totalCharacters: "Personnages",
    totalDialogues: "Répliques",
    totalWords: "Mots",
    estimates: "Estimations",
    minutesPerPage: "min/page",
    estimatedDuration: "Durée estimée",
    
    // Templates
    newScreenplay: "Nouveau scénario",
    chooseTemplate: "Choisissez un modèle",
    blankDocument: "Document vierge",
    startFromScratch: "Commencez de zéro",
    
    // History
    versionHistory: "Historique des versions",
    restore: "Restaurer",
    autoSave: "Sauvegarde auto",
    
    // My documents
    myDocumentsTitle: "Mes documents",
    newDocument: "+ Nouveau document",
    owner: "Propriétaire",
    collaborator: "Collaborateur",
    modified: "Modifié",
    open: "Ouvrir",
    
    // Context menu tooltips
    suggest: "Suggérer",
    comment: "Commenter",
    rewriteWithAI: "Réécrire avec IA",
    
    // AI Rewrite
    aiRewrite: "Réécriture IA",
    selectStyle: "Choisissez un style de réécriture",
    moreConscise: "Plus concis",
    moreDetailed: "Plus détaillé",
    moreDramatic: "Plus dramatique",
    moreHumorous: "Plus humoristique",
    customPrompt: "Instructions personnalisées",
    customPromptPlaceholder: "Ex: Rendre plus poétique, ajouter du suspense...",
    generating: "Génération en cours...",
    originalText: "Texte original",
    suggestedText: "Texte suggéré",
    applySuggestion: "Appliquer",
    
    // Chat
    chat: "Chat",
    typeMessage: "Tapez un message...",
    
    // Misc
    close: "Fermer",
    save: "Sauvegarder",
    loading: "Chargement...",
    untitled: "SANS TITRE",
    you: "(vous)",
    online: "en ligne",
    deleteConfirm: "Supprimer ?",
    
    // Keyboard shortcuts
    keyboardShortcuts: "Raccourcis clavier",
    navigation: "Navigation",
    editing: "Édition",
    formatting: "Formatage",
    
    // Rename character
    renameCharacterTitle: "Renommer un personnage",
    oldName: "Ancien nom",
    newName: "Nouveau nom",
    renameAll: "Renommer toutes les occurrences",
    
    // Writing goal
    writingGoal: "Objectif d'écriture",
    dailyGoal: "Objectif quotidien",
    words: "mots",
    pages: "pages",
    
    // Header tooltips
    invite: "Inviter (copier le lien)",
    teamChat: "Chat d'équipe",
    writingTimer: "Timer d'écriture",
    focusMode: "Mode focus",
    lightMode: "Mode clair",
    darkModeTooltip: "Mode sombre",
    logout: "Déconnexion",
    linkCopied: "Lien copié !",
    reading: "Lecture",
    
    // Outline panel
    filterByStatus: "Filtrer par statut",
    filterByAssigned: "Filtrer par assigné",
    lockScene: "Verrouiller",
    unlockScene: "Déverrouiller",
    sceneLocked: "Scène verrouillée",
    
    // Comments panel
    filterComments: "Filtrer les commentaires",
    filterSuggestions: "Filtrer les suggestions",
    previousComment: "Commentaire précédent",
    nextComment: "Commentaire suivant",
    previousSuggestion: "Suggestion précédente",
    nextSuggestion: "Suggestion suivante",
    reopen: "Rouvrir",
    markResolved: "Marquer comme résolu",
    moreOptions: "Plus d'options",
    clickToViewComment: "Cliquer pour voir le commentaire",
    
    // Misc UI
    expand: "Agrandir",
    collapse: "Réduire",
    scenes: "scènes",
    sceneCount: "scène",
    position: "Position",
    rightClickHint: "💡 Clic droit sur une scène = ajouter un chapitre",
    chapter: "Chapitre",
    replies: "réponses",
    replyCount: "réponse",
    noDocuments: "Aucun document",
    noHistory: "Aucun historique",
    loadingDocument: "Chargement du document...",

    // Outline filters
    allStatuses: "Tous les statuts",
    notDefined: "Non défini",
    allAssignees: "Tous",
    noCommentsOrSuggestions: "Aucun commentaire ou suggestion",
    sequence: "Séquence",
    newDocumentPlaceholder: "Nouveau document",
    
    // Suggestions
    replaceLabel: "Remplacer :",
    by: "par",
    replaceBy: "Remplacer par :",
    typeSuggestion: "Tapez votre suggestion...",
    
    // Beat Board
    beatBoard: "Beat Board",
    newCard: "Nouvelle carte",
    applyOrder: "Appliquer l'ordre au script",
    timeline: "Timeline",
    canvas: "Canvas",
    linkedScene: "Scène liée",
    dragToTimeline: "Glissez des cartes ici pour construire votre timeline",
    allInTimeline: "Toutes vos scènes sont dans la timeline",
    addIdeas: "Cliquez sur \"Nouvelle carte\" pour ajouter des idées",
    // Offline mode
    offlineBanner: "Vous \u00eates hors-ligne \u2014 le document est en lecture seule",
    offlineWorkCopy: "Travailler sur une copie offline",
    offlineMode: "Mode offline \u2014 vos modifications sont enregistr\u00e9es localement",
    offlineSavedLocally: "Sauvegard\u00e9 localement",
    offlineCopyBadge: "(Copie offline)",
    connectionRestored: "Connexion r\u00e9tablie",
    pushChanges: "Pousser les modifications",
    discardOffline: "Abandonner",
    conflictTitle: "Conflit d\u00e9tect\u00e9",
    conflictMessage: "Le document a \u00e9t\u00e9 modifi\u00e9 par d'autres collaborateurs pendant votre absence.",
    conflictOverwrite: "\u00c9craser avec ma version",
    conflictKeepOnline: "Garder la version en ligne",
    conflictCompare: "Voir les deux versions",
    pushSuccess: "Modifications pouss\u00e9es avec succ\u00e8s",
    pushError: "Erreur lors de la synchronisation",
  },
  
  en: {
    // Landing page
    tagline: "Real-time collaborative screenplay editor",
    login: "Sign in / Sign up",
    continueWithoutAccount: "Continue without account",
    noAccountWarning: "Without an account, your documents won't be saved",
    
    // Auth modal
    connection: "Sign In",
    registration: "Sign Up",
    email: "Email",
    password: "Password",
    name: "Name",
    signingIn: "Signing in...",
    registering: "Signing up...",
    signIn: "Sign In",
    register: "Sign Up",
    noAccount: "No account?",
    createOne: "Create one",
    alreadyAccount: "Already have an account?",
    
    // Menu Document
    document: "Document",
    new: "New",
    myDocuments: "My Documents",
    snapshot: "Snapshot",
    history: "History",
    import: "Import",
    export: "Export",
    
    // Menu Outils
    tools: "Tools",
    search: "Search",
    renameCharacter: "Rename Character",
    characters: "Characters",
    statistics: "Statistics",
    goToScene: "Go to Scene",
    sceneNumbers: "Scene Numbers",
    chatNotifications: "Chat Notifications",
    shortcuts: "Shortcuts",
    language: "Language",
    
    // Element types
    scene: "Sequence",
    action: "Action",
    character: "Character",
    dialogue: "Dialogue",
    parenthetical: "Parenthetical",
    transition: "Transition",
    note: "Note",
    
    // Outline
    outline: "Outline",
    status: "Status",
    assigned: "Assigned",
    all: "All",
    inProgress: "In Progress",
    validated: "Done",
    urgent: "Urgent",
    noStatus: "No Status",
    unassigned: "Unassigned",
    none: "None",
    assignTo: "Assign to",
    lock: "Lock",
    unlock: "Unlock",
    
    // Comments sidebar
    comments: "Comments",
    suggestions: "Suggestions",
    addComment: "Add comment",
    reply: "Reply",
    resolve: "Resolve",
    delete: "Delete",
    accept: "Accept",
    reject: "Reject",
    cancel: "Cancel",
    send: "Send",
    edit: "Edit",
    writeComment: "Write a comment...",
    suggestReplacement: "Suggest a replacement...",
    
    // Search & Replace
    searchReplace: "Search / Replace",
    replaceWith: "Replace with",
    replace: "Replace",
    replaceAll: "All",
    noResults: "No results",
    
    // Statistics
    statsTitle: "Screenplay Statistics",
    totalScenes: "Total Scenes",
    totalPages: "Estimated Pages",
    totalCharacters: "Characters",
    totalDialogues: "Dialogues",
    totalWords: "Words",
    estimates: "Estimates",
    minutesPerPage: "min/page",
    estimatedDuration: "Estimated Duration",
    
    // Templates
    newScreenplay: "New Screenplay",
    chooseTemplate: "Choose a template",
    blankDocument: "Blank Document",
    startFromScratch: "Start from scratch",
    
    // History
    versionHistory: "Version History",
    restore: "Restore",
    autoSave: "Auto save",
    
    // My documents
    myDocumentsTitle: "My Documents",
    newDocument: "+ New Document",
    owner: "Owner",
    collaborator: "Collaborator",
    modified: "Modified",
    open: "Open",
    
    // Context menu tooltips
    suggest: "Suggest",
    comment: "Comment",
    rewriteWithAI: "Rewrite with AI",
    
    // AI Rewrite
    aiRewrite: "AI Rewrite",
    selectStyle: "Choose a rewrite style",
    moreConscise: "More concise",
    moreDetailed: "More detailed",
    moreDramatic: "More dramatic",
    moreHumorous: "More humorous",
    customPrompt: "Custom instructions",
    customPromptPlaceholder: "E.g.: Make it more poetic, add suspense...",
    generating: "Generating...",
    originalText: "Original text",
    suggestedText: "Suggested text",
    applySuggestion: "Apply",
    
    // Chat
    chat: "Chat",
    typeMessage: "Type a message...",
    
    // Misc
    close: "Close",
    save: "Save",
    loading: "Loading...",
    untitled: "UNTITLED",
    you: "(you)",
    online: "online",
    deleteConfirm: "Delete?",
    
    // Keyboard shortcuts
    keyboardShortcuts: "Keyboard Shortcuts",
    navigation: "Navigation",
    editing: "Editing",
    formatting: "Formatting",
    
    // Rename character
    renameCharacterTitle: "Rename Character",
    oldName: "Old name",
    newName: "New name",
    renameAll: "Rename all occurrences",
    
    // Writing goal
    writingGoal: "Writing Goal",
    dailyGoal: "Daily goal",
    words: "words",
    pages: "pages",
    
    // Header tooltips
    invite: "Invite (copy link)",
    teamChat: "Team Chat",
    writingTimer: "Writing Timer",
    focusMode: "Focus Mode",
    lightMode: "Light Mode",
    darkModeTooltip: "Dark Mode",
    logout: "Sign out",
    linkCopied: "Link copied!",
    reading: "Read only",
    
    // Outline panel
    filterByStatus: "Filter by status",
    filterByAssigned: "Filter by assigned",
    lockScene: "Lock",
    unlockScene: "Unlock",
    sceneLocked: "Scene locked",
    
    // Comments panel
    filterComments: "Filter comments",
    filterSuggestions: "Filter suggestions",
    previousComment: "Previous comment",
    nextComment: "Next comment",
    previousSuggestion: "Previous suggestion",
    nextSuggestion: "Next suggestion",
    reopen: "Reopen",
    markResolved: "Mark as resolved",
    moreOptions: "More options",
    clickToViewComment: "Click to view comment",
    
    // Misc UI
    expand: "Expand",
    collapse: "Collapse",
    scenes: "scenes",
    sceneCount: "scene",
    position: "Position",
    rightClickHint: "💡 Right-click on a scene = add chapter",
    chapter: "Chapter",
    replies: "replies",
    replyCount: "reply",
    noDocuments: "No documents",
    noHistory: "No history",
    loadingDocument: "Loading document...",

    // Outline filters
    allStatuses: "All statuses",
    notDefined: "Not defined",
    allAssignees: "All",
    noCommentsOrSuggestions: "No comments or suggestions",
    sequence: "Sequence",
    newDocumentPlaceholder: "New document",
    
    // Suggestions
    replaceLabel: "Replace:",
    by: "with",
    replaceBy: "Replace with:",
    typeSuggestion: "Type your suggestion...",
    
    // Beat Board
    beatBoard: "Beat Board",
    newCard: "New card",
    applyOrder: "Apply order to script",
    timeline: "Timeline",
    canvas: "Canvas",
    linkedScene: "Linked scene",
    dragToTimeline: "Drag cards here to build your timeline",
    allInTimeline: "All your scenes are in the timeline",
    addIdeas: "Click \"New card\" to add ideas",
    // Offline mode
    offlineBanner: "You are offline \u2014 document is read-only",
    offlineWorkCopy: "Work on an offline copy",
    offlineMode: "Offline mode \u2014 changes saved locally",
    offlineSavedLocally: "Saved locally",
    offlineCopyBadge: "(Offline copy)",
    connectionRestored: "Connection restored",
    pushChanges: "Push changes",
    discardOffline: "Discard",
    conflictTitle: "Conflict detected",
    conflictMessage: "The document was modified by other collaborators while you were offline.",
    conflictOverwrite: "Overwrite with my version",
    conflictKeepOnline: "Keep online version",
    conflictCompare: "View both versions",
    pushSuccess: "Changes pushed successfully",
    pushError: "Sync error",
  }
};

// Language Context
// eslint-disable-next-line no-unused-vars
const LanguageContext = createContext({ language: 'fr', t: (key) => key, setLanguage: () => {} });

// ============ TIPTAP COMMENT MARK ============
const CommentMark = Mark.create({
  name: 'comment',
  
  addAttributes() {
    return {
      commentId: {
        default: null,
        parseHTML: element => element.getAttribute('data-comment-id'),
        renderHTML: attributes => {
          if (!attributes.commentId) return {};
          return { 'data-comment-id': attributes.commentId };
        },
      },
    };
  },
  
  parseHTML() {
    return [{ tag: 'span[data-comment-id]' }];
  },
  
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, {
      style: 'background-color: rgba(251, 191, 36, 0.4); border-radius: 2px; cursor: pointer;',
    }), 0];
  },
});

// ============ TIPTAP SUGGESTION MARK ============
const SuggestionMark = Mark.create({
  name: 'suggestion',
  
  addAttributes() {
    return {
      suggestionId: {
        default: null,
        parseHTML: element => element.getAttribute('data-suggestion-id'),
        renderHTML: attributes => {
          if (!attributes.suggestionId) return {};
          return { 'data-suggestion-id': attributes.suggestionId };
        },
      },
      suggestedText: {
        default: '',
        parseHTML: element => element.getAttribute('data-suggested-text'),
        renderHTML: attributes => {
          return { 'data-suggested-text': attributes.suggestedText || '' };
        },
      },
    };
  },
  
  parseHTML() {
    return [{ tag: 'span[data-suggestion-id]' }];
  },
  
  renderHTML({ HTMLAttributes }) {
    // Return a structure that shows strikethrough original + green suggestion
    return ['span', mergeAttributes({
      'data-suggestion-id': HTMLAttributes['data-suggestion-id'],
      'data-suggested-text': HTMLAttributes['data-suggested-text'],
      style: 'cursor: pointer;',
    }),
      // Wrapper for the two parts
      ['span', { style: 'text-decoration: line-through; color: #dc2626; background: rgba(220, 38, 38, 0.1);' }, 0], // 0 = original content goes here
      ['span', { 
        style: 'color: #16a34a; background: rgba(22, 163, 74, 0.1); margin-left: 2px;',
        contenteditable: 'false',
        'data-suggestion-display': 'true',
      }, HTMLAttributes['data-suggested-text'] || ''],
    ];
  },
});

// ============ SCREENPLAY ELEMENT NODE (Single TipTap Editor) ============
// Final Draft element type transitions
const SP_NEXT_TYPE = { scene: 'action', action: 'action', character: 'dialogue', dialogue: 'character', parenthetical: 'dialogue', transition: 'scene' };
const SP_EMPTY_ENTER = (t) => (t === 'action' ? null : 'action');
const SP_TAB_FWD = { scene: 'action', action: 'character', character: 'parenthetical', parenthetical: 'dialogue', dialogue: 'transition', transition: 'scene' };
const SP_TAB_REV = { scene: 'transition', transition: 'dialogue', dialogue: 'parenthetical', parenthetical: 'character', character: 'action', action: 'scene' };

const ScreenplayElement = Node.create({
  name: 'screenplayElement',
  group: 'block',
  content: 'inline*',
  defining: true,

  addAttributes() {
    return {
      elementId: {
        default: null,
        parseHTML: el => el.getAttribute('data-element-id'),
        renderHTML: attrs => ({ 'data-element-id': attrs.elementId }),
      },
      elementType: {
        default: 'action',
        parseHTML: el => el.getAttribute('data-element-type') || 'action',
        renderHTML: attrs => ({ 'data-element-type': attrs.elementType }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-screenplay-element]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const type = HTMLAttributes['data-element-type'] || 'action';
    return ['div', mergeAttributes(HTMLAttributes, {
      'data-screenplay-element': 'true',
      class: `screenplay-${type}`,
    }), 0];
  },

  addCommands() {
    return {
      // Split at cursor, new block gets the next type per Final Draft rules
      splitScreenplayElement: () => ({ tr, state, dispatch, editor }) => {
        const { $from, from } = state.selection;
        const node = $from.parent;
        if (node.type.name !== 'screenplayElement') return false;

        const currentType = node.attrs.elementType;
        const atStart = $from.parentOffset === 0;
        const atEnd = $from.parentOffset >= node.content.size;
        const isEmpty = node.content.size === 0;
        const nodeStart = $from.before();

        // Auto-close parenthetical
        if (currentType === 'parenthetical' && !isEmpty) {
          const text = node.textContent;
          let fixed = text;
          if (!fixed.startsWith('(')) fixed = '(' + fixed;
          if (!fixed.endsWith(')')) fixed = fixed + ')';
          if (fixed !== text) {
            // Replace text content
            tr.delete(nodeStart + 1, nodeStart + 1 + node.content.size);
            tr.insertText(fixed, nodeStart + 1);
          }
        }

        if (isEmpty) {
          // Empty block + Enter → convert to Action (or delete if already Action)
          const target = SP_EMPTY_ENTER(currentType);
          if (target) {
            tr.setNodeMarkup(nodeStart, null, { ...node.attrs, elementType: target });
            if (dispatch) dispatch(tr);
            return true;
          } else {
            // Already Action and empty — delete this block if not the only one
            if (state.doc.childCount > 1) {
              // Delete the node, move cursor to end of previous
              const $pos = state.doc.resolve(nodeStart);
              const indexInDoc = $pos.index($pos.depth);
              if (indexInDoc > 0) {
                const prevEnd = nodeStart - 1; // end of previous node content
                tr.delete(nodeStart, nodeStart + node.nodeSize);
                tr.setSelection(state.selection.constructor.near(tr.doc.resolve(Math.min(prevEnd, tr.doc.content.size))));
                if (dispatch) dispatch(tr);
                return true;
              }
            }
            return true;
          }
        }

        if (atEnd) {
          // Cursor at end → insert new element after with next type
          const nextType = SP_NEXT_TYPE[currentType] || 'action';
          const newId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
          const insertPos = nodeStart + node.nodeSize;
          const newNode = state.schema.nodes.screenplayElement.create(
            { elementId: newId, elementType: nextType },
            null
          );
          tr.insert(insertPos, newNode);
          tr.setSelection(state.selection.constructor.near(tr.doc.resolve(insertPos + 1)));
          if (dispatch) dispatch(tr);
          return true;
        }

        if (atStart) {
          // Cursor at start → insert empty block BEFORE of same type, push content down
          const newId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
          const newNode = state.schema.nodes.screenplayElement.create(
            { elementId: newId, elementType: currentType },
            null
          );
          tr.insert(nodeStart, newNode);
          // Cursor stays on original content (now shifted down)
          tr.setSelection(state.selection.constructor.near(tr.doc.resolve(nodeStart + newNode.nodeSize + 1)));
          if (dispatch) dispatch(tr);
          return true;
        }

        // Mid-block split: both halves keep the same type, new half gets new ID
        const newId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
        // Use ProseMirror's native split and then fix up attributes
        tr.split(from, 1, [{ type: state.schema.nodes.screenplayElement, attrs: { elementId: newId, elementType: currentType } }]);
        if (dispatch) dispatch(tr);
        return true;
      },

      // Cycle element type with Tab
      cycleType: (reverse) => ({ tr, state, dispatch }) => {
        const { $from } = state.selection;
        const node = $from.parent;
        if (node.type.name !== 'screenplayElement') return false;

        const currentType = node.attrs.elementType;
        const cycle = reverse ? SP_TAB_REV : SP_TAB_FWD;
        const newType = cycle[currentType] || 'action';
        const nodeStart = $from.before();

        // Auto-close parenthetical if leaving it
        if (currentType === 'parenthetical' && node.content.size > 0) {
          const text = node.textContent;
          let fixed = text;
          if (!fixed.startsWith('(')) fixed = '(' + fixed;
          if (!fixed.endsWith(')')) fixed = fixed + ')';
          if (fixed !== text) {
            tr.delete(nodeStart + 1, nodeStart + 1 + node.content.size);
            tr.insertText(fixed, nodeStart + 1);
          }
        }

        tr.setNodeMarkup(nodeStart, null, { ...node.attrs, elementType: newType });
        if (dispatch) dispatch(tr);
        return true;
      },

      // Set a specific type
      setScreenplayType: (type) => ({ tr, state, dispatch }) => {
        const { $from } = state.selection;
        const node = $from.parent;
        if (node.type.name !== 'screenplayElement') return false;
        const nodeStart = $from.before();
        tr.setNodeMarkup(nodeStart, null, { ...node.attrs, elementType: type });
        if (dispatch) dispatch(tr);
        return true;
      },

      // Handle Backspace at element boundary
      handleScreenplayBackspace: () => ({ tr, state, dispatch, editor }) => {
        const { $from, empty } = state.selection;
        // Only intercept if cursor is at start of a screenplayElement and selection is collapsed
        if (!empty) return false;
        const node = $from.parent;
        if (node.type.name !== 'screenplayElement') return false;
        if ($from.parentOffset !== 0) return false; // Not at start → let default handle it

        const nodeStart = $from.before();
        const $nodePos = state.doc.resolve(nodeStart);
        const indexInDoc = $nodePos.index($nodePos.depth);

        // First element — can't merge backward
        if (indexInDoc === 0) return false;

        const prevNode = state.doc.child(indexInDoc - 1);
        const prevStart = nodeStart - prevNode.nodeSize;
        const currentIsEmpty = node.content.size === 0;
        const prevIsEmpty = prevNode.content.size === 0;

        if (currentIsEmpty && state.doc.childCount > 1) {
          // Current is empty → delete it, focus end of previous
          tr.delete(nodeStart, nodeStart + node.nodeSize);
          const targetPos = prevStart + 1 + prevNode.content.size;
          tr.setSelection(state.selection.constructor.near(tr.doc.resolve(Math.min(targetPos, tr.doc.content.size))));
          if (dispatch) dispatch(tr);
          return true;
        }

        if (prevIsEmpty) {
          // Previous is empty → delete previous, stay in current
          tr.delete(prevStart, prevStart + prevNode.nodeSize);
          if (dispatch) dispatch(tr);
          return true;
        }

        // Both have content → merge current INTO previous (result takes previous's type)
        // Append current's content to end of previous, then delete current node
        const prevContentEnd = prevStart + 1 + prevNode.content.size;
        const cursorTarget = prevContentEnd; // Where the join point will be

        // Use joinBackward-like approach: delete the boundary between the two nodes
        // This means deleting from end of prev node to start of current node content
        const gapStart = prevStart + prevNode.nodeSize; // End of prev node (closing token)
        const gapEnd = nodeStart + 1; // Start of current node content (after opening token)

        // Delete the gap (prev closing + current opening) to join them
        tr.delete(gapStart, gapEnd);
        // The result node keeps the prev node's attributes (type) since we're joining into it
        tr.setSelection(state.selection.constructor.near(tr.doc.resolve(Math.min(cursorTarget, tr.doc.content.size))));
        if (dispatch) dispatch(tr);
        return true;
      },
    };
  },

  addKeyboardShortcuts() {
    return {
      'Enter': () => this.editor.commands.splitScreenplayElement(),
      'Tab': () => this.editor.commands.cycleType(false),
      'Shift-Tab': () => this.editor.commands.cycleType(true),
      'Backspace': () => this.editor.commands.handleScreenplayBackspace(),
      // Cmd/Ctrl+1-6 for quick type change
      'Mod-1': () => this.editor.commands.setScreenplayType('scene'),
      'Mod-2': () => this.editor.commands.setScreenplayType('action'),
      'Mod-3': () => this.editor.commands.setScreenplayType('character'),
      'Mod-4': () => this.editor.commands.setScreenplayType('dialogue'),
      'Mod-5': () => this.editor.commands.setScreenplayType('parenthetical'),
      'Mod-6': () => this.editor.commands.setScreenplayType('transition'),
    };
  },
});

// ============ SCREENPLAY EDITOR HELPERS ============
// Build ProseMirror doc JSON from elements array
function buildDocFromElements(els) {
  if (!els || els.length === 0) {
    return { type: 'doc', content: [{ type: 'screenplayElement', attrs: { elementId: generateId(), elementType: 'action' } }] };
  }
  return {
    type: 'doc',
    content: els.map(el => ({
      type: 'screenplayElement',
      attrs: { elementId: el.id, elementType: el.type || 'action' },
      content: el.content && stripHtml(el.content).length > 0
        ? [{ type: 'text', text: stripHtml(el.content) }]
        : [],
    })),
  };
}

// Extract elements array from ProseMirror doc
function extractElementsFromDoc(doc) {
  const result = [];
  doc.forEach(node => {
    if (node.type.name === 'screenplayElement') {
      result.push({
        id: node.attrs.elementId || generateId(),
        type: node.attrs.elementType || 'action',
        content: node.textContent || '',
      });
    }
  });
  return result;
}

// Compare two elements arrays for equality (shallow)
function elementsEqual(a, b) {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].id !== b[i].id || a[i].type !== b[i].type || a[i].content !== b[i].content) return false;
  }
  return true;
}

// Page break decoration plugin for ProseMirror
const pageBreakPluginKey = new PluginKey('pageBreaks');

function createPageBreakPlugin(computePageInfoFn, stripHtmlFn, darkMode) {
  return new Plugin({
    key: pageBreakPluginKey,
    props: {
      decorations: (state) => {
        const els = extractElementsFromDoc(state.doc);
        if (els.length === 0) return DecorationSet.empty;
        const { pageBreaks, pageNumbers } = computePageInfoFn(els);
        if (pageBreaks.size === 0) return DecorationSet.empty;
        const decorations = [];
        let nodeIndex = 0;
        state.doc.forEach((node, pos) => {
          if (node.type.name === 'screenplayElement' && pageBreaks.has(nodeIndex)) {
            decorations.push(Decoration.widget(pos, () => {
              const div = document.createElement('div');
              div.className = 'page-break-decoration';
              div.setAttribute('contenteditable', 'false');
              const gapBg = darkMode ? '#2b2b2b' : '#e5e7eb';
              div.style.background = gapBg;
              div.innerHTML = '<span class="page-break-number">' + (pageNumbers[nodeIndex] || '') + '.</span>';
              return div;
            }, { side: -1, key: 'pb-' + nodeIndex }));
          }
          nodeIndex++;
        });
        return DecorationSet.create(state.doc, decorations);
      },
    },
  });
}

// Helper to escape HTML entities (used by FDX export — keep for future use)
// eslint-disable-next-line no-unused-vars
const escapeHtml = (text) => {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

// Strip HTML tags to get plain text (for word count, autocomplete, exports, etc.)
const stripHtml = (html) => {
  if (!html) return '';
  return String(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
};

// V272: extractTipTapContent supprimé (plus besoin avec le single editor)

// UUID fallback for browsers that don't support crypto.randomUUID
const generateId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for older browsers (Safari, etc.)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : ((r & 0x3) | 0x8)).toString(16);
  });
};

// eslint-disable-next-line no-unused-vars
const ELEMENT_TYPES = [
  { id: 'scene', label: 'Séquence', shortcut: '1' },
  { id: 'action', label: 'Action', shortcut: '2' },
  { id: 'character', label: 'Personnage', shortcut: '3' },
  { id: 'dialogue', label: 'Dialogue', shortcut: '4' },
  { id: 'parenthetical', label: 'Didascalie', shortcut: '5' },
  { id: 'transition', label: 'Transition', shortcut: '6' },
];

const TYPE_TO_FDX = { scene: 'Scene Heading', action: 'Action', character: 'Character', dialogue: 'Dialogue', parenthetical: 'Parenthetical', transition: 'Transition' };
const FDX_TO_TYPE = { 'Scene Heading': 'scene', 'Action': 'action', 'Character': 'character', 'Dialogue': 'dialogue', 'Parenthetical': 'parenthetical', 'Transition': 'transition', 'General': 'action' };
const LINES_PER_PAGE = 57;

// ============ AUTH MODAL ============
const AuthModal = ({ onLogin, onClose, t = (k) => k }) => {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const name = mode === 'register' ? `${firstName} ${lastName}`.trim() : '';
      const body = mode === 'login' ? { email, password } : { email, password, name };
      const res = await fetch(SERVER_URL + endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      localStorage.setItem('screenplay-token', data.token);
      localStorage.setItem('screenplay-user', JSON.stringify(data.user));
      onLogin(data.user, data.token);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const inputStyle = {
    width: '100%',
    padding: '12px 14px',
    background: '#2b2b2b',
    border: '1px solid #484848',
    borderRadius: 8,
    color: 'white',
    fontSize: 14,
    boxSizing: 'border-box',
    outline: 'none',
    transition: 'border-color 0.2s'
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#333333', borderRadius: 12, padding: 32, width: 'calc(100% - 32px)', maxWidth: 380, boxShadow: '0 25px 50px rgba(0,0,0,0.5)', border: '1px solid #484848' }}>
        <h2 style={{ color: 'white', fontSize: 22, marginBottom: 24, textAlign: 'center', fontWeight: 600 }}>{mode === 'login' ? t('connection') : t('registration')}</h2>
        <form onSubmit={handleSubmit}>
          {mode === 'register' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <input 
                type="text" 
                placeholder={t('name')} 
                value={firstName} 
                onChange={e => setFirstName(e.target.value)} 
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#3b82f6'}
                onBlur={e => e.target.style.borderColor = '#484848'}
                required 
              />
              <input 
                type="text" 
                placeholder={t('name')} 
                value={lastName} 
                onChange={e => setLastName(e.target.value)} 
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#3b82f6'}
                onBlur={e => e.target.style.borderColor = '#484848'}
                required 
              />
            </div>
          )}
          <input 
            type="email" 
            placeholder={t('email')} 
            value={email} 
            onChange={e => setEmail(e.target.value)} 
            style={{ ...inputStyle, marginBottom: 12 }}
            onFocus={e => e.target.style.borderColor = '#3b82f6'}
            onBlur={e => e.target.style.borderColor = '#484848'}
            required 
          />
          <input 
            type="password" 
            placeholder={t('password')} 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            style={{ ...inputStyle, marginBottom: 16 }}
            onFocus={e => e.target.style.borderColor = '#3b82f6'}
            onBlur={e => e.target.style.borderColor = '#484848'}
            required 
          />
          {error && <p style={{ color: '#f87171', fontSize: 13, marginBottom: 16, textAlign: 'center' }}>{error}</p>}
          <button 
            type="submit" 
            disabled={loading} 
            style={{ 
              width: '100%', 
              padding: 14, 
              background: '#3b82f6', 
              border: 'none', 
              borderRadius: 8, 
              color: 'white', 
              fontSize: 14, 
              fontWeight: 600, 
              cursor: loading ? 'wait' : 'pointer',
              opacity: loading ? 0.7 : 1,
              transition: 'opacity 0.2s'
            }}
          >
            {loading ? t('loading') : mode === 'login' ? t('signIn') : t('register')}
          </button>
        </form>
        <p style={{ marginTop: 20, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
          {mode === 'login' ? t('noAccount') : t('alreadyAccount')}
          <button 
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }} 
            style={{ marginLeft: 8, color: '#60a5fa', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
          >
            {mode === 'login' ? t('createOne') : t('signIn')}
          </button>
        </p>
        <button 
          onClick={onClose} 
          style={{ 
            marginTop: 16, 
            width: '100%', 
            padding: 12, 
            background: 'transparent', 
            border: '1px solid #484848', 
            borderRadius: 8, 
            color: '#6b7280', 
            cursor: 'pointer', 
            fontSize: 13 
          }}
        >
          {t('continueWithoutAccount')}
        </button>
      </div>
    </div>
  );
};

// ============ DOCUMENTS LIST ============
const DocumentsList = ({ token, onSelectDoc, onCreateDoc, onClose, t = (k) => k }) => {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDocs = async () => {
      try {
        const res = await fetch(SERVER_URL + '/api/documents', { headers: { Authorization: 'Bearer ' + token } });
        const data = await res.json();
        setDocs(data.documents || []);
      } catch (err) { console.error(err); }
      setLoading(false);
    };
    if (token) fetchDocs();
  }, [token]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#333333', borderRadius: 12, padding: 32, width: '100%', maxWidth: 600, maxHeight: '80vh', overflow: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ color: 'white', fontSize: 24, margin: 0 }}>{t('myDocumentsTitle')}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: 24, cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>
        <button onClick={onCreateDoc} style={{ width: '100%', padding: 16, background: '#059669', border: 'none', borderRadius: 8, color: 'white', fontSize: 16, fontWeight: 'bold', cursor: 'pointer', marginBottom: 24 }}>{t('newDocument')}</button>
        {loading ? <p style={{ color: '#9ca3af', textAlign: 'center' }}>{t('loading')}</p> : docs.length === 0 ? <p style={{ color: '#9ca3af', textAlign: 'center' }}>{t('noDocuments')}</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {docs.map(doc => (
              <button key={doc.shortId} onClick={() => onSelectDoc(doc.shortId)} style={{ padding: 16, background: '#484848', border: 'none', borderRadius: 8, color: 'white', textAlign: 'left', cursor: 'pointer', transition: 'background 0.2s' }} onMouseOver={e => e.target.style.background = '#555555'} onMouseOut={e => e.target.style.background = '#484848'}>
                <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{doc.title || 'SANS TITRE'}</div>
                <div style={{ fontSize: 12, color: '#9ca3af' }}>{new Date(doc.updatedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ============ HISTORY PANEL ============
const HistoryPanel = ({ docId, token, currentTitle, onRestore, onClose, t = (k) => k }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch(SERVER_URL + '/api/documents/' + docId + '/history', { headers: { Authorization: 'Bearer ' + token } });
        const data = await res.json();
        setHistory(data.history || []);
      } catch (err) { console.error(err); }
      setLoading(false);
    };
    if (token && docId) fetchHistory();
  }, [token, docId]);

  const handleRestore = async (entry) => {
    if (!window.confirm('Créer un nouveau document à partir de ce snapshot ?')) return;
    setRestoring(true);
    try {
      // Use snapshotName if available, otherwise generate from date
      let newTitle;
      if (entry.snapshotName) {
        newTitle = entry.snapshotName;
      } else {
        const snapshotDate = new Date(entry.createdAt);
        const dateStr = snapshotDate.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(/[/:]/g, '-').replace(', ', '_');
        newTitle = (entry.data.title || currentTitle || 'SANS TITRE') + '_' + dateStr;
      }
      
      // Create new document with snapshot data
      const res = await fetch(SERVER_URL + '/api/documents/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ title: newTitle, elements: entry.data.elements })
      });
      
      if (res.ok) {
        const data = await res.json();
        console.log('[RESTORE] Created new document:', data.id);
        onClose();
        window.location.hash = data.id;
      } else {
        alert('Erreur lors de la restauration');
      }
    } catch (err) { 
      console.error(err);
      alert('Erreur: ' + err.message);
    }
    setRestoring(false);
  };

  const actionLabels = { 'title-change': '📝 Titre modifié', 'element-change': '✏️ Élément modifié', 'element-type-change': '🔄 Type changé', 'element-insert': '➕ Élément ajouté', 'element-delete': '🗑️ Élément supprimé', 'snapshot': '📸 Snapshot' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#333333', borderRadius: 12, padding: 32, width: '100%', maxWidth: 600, maxHeight: '80vh', overflow: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ color: 'white', fontSize: 24, margin: 0 }}>{t('versionHistory')}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: 24, cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>
        {restoring && <p style={{ color: '#60a5fa', textAlign: 'center', marginBottom: 16 }}>{t('loading')}</p>}
        {loading ? <p style={{ color: '#9ca3af', textAlign: 'center' }}>{t('loading')}</p> : history.length === 0 ? <p style={{ color: '#9ca3af', textAlign: 'center' }}>{t('noHistory')}</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {history.map(entry => {
              // Generate snapshot name from date if not provided
              const getSnapshotDisplayName = () => {
                if (entry.snapshotName) return entry.snapshotName;
                if (entry.action === 'snapshot') {
                  const d = new Date(entry.createdAt);
                  const pad = n => n.toString().padStart(2, '0');
                  const title = entry.data?.title || currentTitle || 'SANS TITRE';
                  return `${title} - ${pad(d.getDate())}/${pad(d.getMonth()+1)}/${String(d.getFullYear()).slice(-2)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
                }
                return actionLabels[entry.action] || entry.action;
              };
              
              return (
                <div key={entry._id} style={{ padding: 16, background: '#484848', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: entry.userColor || '#666', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: 14, flexShrink: 0 }}>{entry.userName?.charAt(0).toUpperCase() || '?'}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: 'white', fontWeight: 'bold', marginBottom: 4, fontSize: 13 }}>
                      {getSnapshotDisplayName()}
                    </div>
                    <div style={{ fontSize: 12, color: '#9ca3af' }}>{entry.userName} • {new Date(entry.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                  {entry.action === 'snapshot' && <button onClick={() => handleRestore(entry)} disabled={restoring} style={{ padding: '8px 16px', background: '#2563eb', border: 'none', borderRadius: 6, color: 'white', cursor: 'pointer', fontSize: 12, opacity: restoring ? 0.5 : 1 }}>{t('restore')}</button>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ============ INLINE COMMENT (Google Docs style) ============
// Render text with @mentions highlighted
const renderWithMentions = (text, darkMode) => {
  if (!text) return '';
  const parts = text.split(/(@\w+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('@')) {
      return (
        <span 
          key={i} 
          style={{ 
            color: '#3b82f6', 
            fontWeight: 600,
            background: darkMode ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)',
            padding: '1px 4px',
            borderRadius: 3
          }}
        >
          {part}
        </span>
      );
    }
    return part;
  });
};

const InlineComment = React.memo(({ comment, onReply, onResolve, onDelete, onEdit, canComment, isReplying, replyContent, onReplyChange, onSubmitReply, onCancelReply, darkMode, isSelected, mentionableUsers, t = (k) => k }) => {
  const replyInputRef = useRef(null);
  const editInputRef = useRef(null);
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(comment.content);
  const [showReplyMentions, setShowReplyMentions] = useState(false);
  const [replyMentionSearch, setReplyMentionSearch] = useState('');
  const [replyMentionIndex, setReplyMentionIndex] = useState(0);
  
  useEffect(() => { if (isReplying && replyInputRef.current) replyInputRef.current.focus(); }, [isReplying]);
  useEffect(() => { if (isEditing && editInputRef.current) editInputRef.current.focus(); }, [isEditing]);
  
  // Filter mentions based on search
  const filteredReplyMentions = useMemo(() => {
    if (!mentionableUsers) return [];
    if (!replyMentionSearch) return mentionableUsers;
    return mentionableUsers.filter(u => 
      u.name.toLowerCase().includes(replyMentionSearch.toLowerCase())
    );
  }, [mentionableUsers, replyMentionSearch]);

  // Handle @ detection in reply text
  const handleReplyChange = (e) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart;
    onReplyChange(value);
    
    const textBeforeCursor = value.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@(\w*)$/);
    
    if (atMatch) {
      setShowReplyMentions(true);
      setReplyMentionSearch(atMatch[1]);
      setReplyMentionIndex(0);
    } else {
      setShowReplyMentions(false);
      setReplyMentionSearch('');
    }
  };

  // Insert mention into reply
  const insertReplyMention = (userName) => {
    // Use the stored mention search to find where to insert
    // This is more reliable than relying on cursor position after click
    const atPattern = new RegExp('@' + replyMentionSearch + '$');
    const newText = replyContent.replace(atPattern, '@' + userName + ' ');
    onReplyChange(newText);
    
    setShowReplyMentions(false);
    setReplyMentionSearch('');
    
    // Focus back on textarea
    setTimeout(() => {
      if (replyInputRef.current) {
        replyInputRef.current.focus();
      }
    }, 0);
  };
  
  // Close menu when clicking outside
  useEffect(() => {
    if (showMenu) {
      const handleClick = () => setShowMenu(false);
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [showMenu]);

  // Compact view when not selected
  if (!isSelected) {
    return (
      <div style={{ 
        background: darkMode ? '#2d3748' : 'white', 
        borderRadius: 8, 
        padding: '10px 12px',
        marginBottom: 6,
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        cursor: 'pointer'
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ 
            width: 28, 
            height: 28, 
            borderRadius: '50%', 
            background: comment.userColor || '#666', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            color: 'white', 
            fontWeight: 'bold', 
            fontSize: 12,
            flexShrink: 0
          }}>
            {comment.userName?.charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ color: darkMode ? 'white' : '#333333', fontWeight: 600, fontSize: 13 }}>{comment.userName}</span>
              <span style={{ color: '#9ca3af', fontSize: 11 }}>
                {new Date(comment.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
              </span>
              {comment.resolved && <span style={{ fontSize: 9, background: '#10b981', color: 'white', padding: '1px 6px', borderRadius: 10 }}>✓</span>}
            </div>
            <p style={{ 
              color: darkMode ? '#e5e7eb' : '#484848', 
              margin: 0, 
              fontSize: 13, 
              lineHeight: 1.4,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical'
            }}>
              {renderWithMentions(comment.content, darkMode)}
            </p>
            {comment.replies?.length > 0 && (
              <span style={{ color: '#6b7280', fontSize: 11, marginTop: 4, display: 'block' }}>
                {comment.replies.length} {comment.replies.length > 1 ? t('replies') : t('replyCount')}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Expanded view when selected
  return (
    <div style={{ 
      background: darkMode ? '#484848' : 'white', 
      borderRadius: 8, 
      padding: '12px 14px',
      marginBottom: 6,
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      border: `1px solid ${darkMode ? '#555555' : '#e5e7eb'}`
    }}>
      {/* Header with avatar, name, date, and action icons */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
        <div style={{ 
          width: 32, 
          height: 32, 
          borderRadius: '50%', 
          background: comment.userColor || '#666', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          color: 'white', 
          fontWeight: 'bold', 
          fontSize: 13,
          flexShrink: 0
        }}>
          {comment.userName?.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: darkMode ? 'white' : '#333333', fontWeight: 600, fontSize: 13 }}>{comment.userName}</span>
            <span style={{ color: '#9ca3af', fontSize: 11 }}>
              {new Date(comment.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
              {' '}
              {new Date(comment.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          {comment.resolved && <span style={{ fontSize: 10, color: '#10b981', marginTop: 2, display: 'block' }}>Résolu</span>}
        </div>
        {/* Action icons - Google Docs style */}
        {canComment && (
          <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
            <button 
              onClick={(e) => { e.stopPropagation(); onResolve(comment.id); }}
              title={comment.resolved ? t('reopen') : t('markResolved')}
              style={{ 
                width: 28, 
                height: 28, 
                borderRadius: '50%', 
                border: 'none', 
                background: comment.resolved ? '#10b981' : (darkMode ? '#555555' : '#f3f4f6'),
                color: comment.resolved ? 'white' : (darkMode ? '#9ca3af' : '#6b7280'),
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                if (!comment.resolved) {
                  e.currentTarget.style.background = '#10b981';
                  e.currentTarget.style.color = 'white';
                } else {
                  e.currentTarget.style.background = '#059669';
                }
              }}
              onMouseLeave={(e) => {
                if (!comment.resolved) {
                  e.currentTarget.style.background = darkMode ? '#555555' : '#f3f4f6';
                  e.currentTarget.style.color = darkMode ? '#9ca3af' : '#6b7280';
                } else {
                  e.currentTarget.style.background = '#10b981';
                }
              }}
            >
              ✓
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
              title={t('moreOptions')}
              style={{ 
                width: 28, 
                height: 28, 
                borderRadius: '50%', 
                border: 'none', 
                background: darkMode ? '#555555' : '#f3f4f6',
                color: darkMode ? '#9ca3af' : '#6b7280',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
                position: 'relative'
              }}
            >
              ⋮
              {/* Dropdown menu */}
              {showMenu && (
                <div 
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: 4,
                    background: darkMode ? '#484848' : 'white',
                    border: `1px solid ${darkMode ? '#555555' : '#e5e7eb'}`,
                    borderRadius: 8,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    zIndex: 100,
                    minWidth: 140,
                    overflow: 'hidden'
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      setShowMenu(false);
                      setIsEditing(true);
                      setEditText(comment.content);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      width: '100%',
                      padding: '10px 14px',
                      background: 'none',
                      border: 'none',
                      textAlign: 'left',
                      cursor: 'pointer',
                      color: darkMode ? '#e5e7eb' : '#484848',
                      fontSize: 13
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = darkMode ? '#555555' : '#f3f4f6'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
                    </svg>
                    {t('edit')}
                  </button>
                  <button
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      setShowMenu(false);
                      onDelete && onDelete(comment.id); 
                    }}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '10px 14px',
                      background: 'none',
                      border: 'none',
                      textAlign: 'left',
                      cursor: 'pointer',
                      color: '#ef4444',
                      fontSize: 13
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = darkMode ? '#555555' : '#f3f4f6'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                  >
                    🗑️ {t('delete')}
                  </button>
                </div>
              )}
            </button>
          </div>
        )}
      </div>
      
      {/* Comment content - or edit form if editing */}
      {isEditing ? (
        <div style={{ marginBottom: 10 }}>
          <textarea
            ref={editInputRef}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && editText.trim()) {
                e.preventDefault();
                onEdit && onEdit(comment.id, editText);
                setIsEditing(false);
              }
              if (e.key === 'Escape') {
                setIsEditing(false);
                setEditText(comment.content);
              }
            }}
            style={{
              width: '100%',
              padding: 10,
              border: `2px solid #1a73e8`,
              borderRadius: 6,
              fontSize: 13,
              resize: 'none',
              minHeight: 60,
              background: darkMode ? '#333333' : 'white',
              color: darkMode ? 'white' : '#484848',
              boxSizing: 'border-box'
            }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
            <button
              onClick={() => {
                setIsEditing(false);
                setEditText(comment.content);
              }}
              style={{
                padding: '6px 14px',
                background: 'transparent',
                border: 'none',
                borderRadius: 4,
                color: darkMode ? '#9ca3af' : '#5f6368',
                cursor: 'pointer',
                fontSize: 12
              }}
            >
              {t('cancel')}
            </button>
            <button
              onClick={() => {
                if (editText.trim()) {
                  onEdit && onEdit(comment.id, editText);
                  setIsEditing(false);
                }
              }}
              disabled={!editText.trim()}
              style={{
                padding: '6px 14px',
                background: editText.trim() ? '#1a73e8' : '#d1d5db',
                border: 'none',
                borderRadius: 4,
                color: 'white',
                cursor: editText.trim() ? 'pointer' : 'not-allowed',
                fontSize: 12,
                fontWeight: 500
              }}
            >
              Enregistrer
            </button>
          </div>
        </div>
      ) : (
        <p style={{ 
          color: darkMode ? '#e5e7eb' : '#484848', 
          margin: '0 0 10px 0', 
          fontSize: 13, 
          lineHeight: 1.5
        }}>
          {renderWithMentions(comment.content, darkMode)}
        </p>
      )}
      
      {/* Replies */}
      {comment.replies?.map(reply => (
        <div key={reply.id} style={{ 
          marginTop: 10, 
          paddingTop: 10, 
          borderTop: `1px solid ${darkMode ? '#555555' : '#e5e7eb'}` 
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ 
              width: 24, 
              height: 24, 
              borderRadius: '50%', 
              background: reply.userColor || '#888', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              color: 'white', 
              fontWeight: 'bold', 
              fontSize: 10,
              flexShrink: 0
            }}>
              {reply.userName?.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: darkMode ? 'white' : '#333333', fontWeight: 600, fontSize: 12 }}>{reply.userName}</span>
                <span style={{ color: '#9ca3af', fontSize: 10 }}>
                  {new Date(reply.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                </span>
              </div>
              <p style={{ color: darkMode ? '#d1d5db' : '#484848', margin: '2px 0 0 0', fontSize: 12, lineHeight: 1.4 }}>{renderWithMentions(reply.content, darkMode)}</p>
            </div>
          </div>
        </div>
      ))}
      
      {/* Reply input - Google Docs style */}
      {canComment && (
        isReplying ? (
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${darkMode ? '#555555' : '#e5e7eb'}`, position: 'relative' }}>
            <textarea 
              ref={replyInputRef} 
              value={replyContent} 
              onChange={handleReplyChange} 
              placeholder={`${t('reply')}... (@mention)`} 
              onKeyDown={(e) => {
                // Handle mention navigation
                if (showReplyMentions && filteredReplyMentions.length > 0) {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setReplyMentionIndex(i => Math.min(i + 1, filteredReplyMentions.length - 1));
                    return;
                  }
                  if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setReplyMentionIndex(i => Math.max(i - 1, 0));
                    return;
                  }
                  if (e.key === 'Enter' || e.key === 'Tab') {
                    e.preventDefault();
                    insertReplyMention(filteredReplyMentions[replyMentionIndex].name);
                    return;
                  }
                  if (e.key === 'Escape') {
                    setShowReplyMentions(false);
                    return;
                  }
                }
                
                if (e.key === 'Enter' && !e.shiftKey && replyContent.trim() && !showReplyMentions) {
                  e.preventDefault();
                  onSubmitReply(comment.id);
                }
                if (e.key === 'Escape' && !showReplyMentions) {
                  onCancelReply();
                }
              }}
              style={{ 
                width: '100%', 
                padding: 10, 
                background: darkMode ? '#333333' : '#f9fafb', 
                border: `1px solid ${darkMode ? '#555555' : '#e5e7eb'}`, 
                borderRadius: 6, 
                color: darkMode ? 'white' : '#484848', 
                fontSize: 12, 
                resize: 'none', 
                boxSizing: 'border-box' 
              }} 
              rows={2} 
            />
            
            {/* Mentions dropdown for reply */}
            {showReplyMentions && filteredReplyMentions.length > 0 && (
              <div 
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.preventDefault()}
                style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: 0,
                  right: 0,
                  marginBottom: 4,
                  background: darkMode ? '#484848' : 'white',
                  border: `1px solid ${darkMode ? '#555555' : '#d1d5db'}`,
                  borderRadius: 6,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  maxHeight: 120,
                  overflow: 'auto',
                  zIndex: 10
                }}>
                {filteredReplyMentions.map((user, idx) => (
                  <div
                    key={user.name}
                    onClick={(e) => { e.stopPropagation(); insertReplyMention(user.name); }}
                    onMouseDown={(e) => e.preventDefault()}
                    style={{
                      padding: '6px 10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      cursor: 'pointer',
                      background: idx === replyMentionIndex ? (darkMode ? '#555555' : '#f3f4f6') : 'transparent'
                    }}
                    onMouseEnter={() => setReplyMentionIndex(idx)}
                  >
                    <div style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      background: user.color || '#3b82f6',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: 9,
                      fontWeight: 'bold',
                      position: 'relative'
                    }}>
                      {user.name.charAt(0).toUpperCase()}
                      <span style={{
                        position: 'absolute',
                        bottom: -1,
                        right: -1,
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: user.online ? '#22c55e' : '#6b7280',
                        border: `1px solid ${darkMode ? '#484848' : 'white'}`
                      }} />
                    </div>
                    <span style={{ fontSize: 11, color: darkMode ? 'white' : '#484848' }}>
                      {user.name}
                    </span>
                  </div>
                ))}
              </div>
            )}
            
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button 
                onClick={() => onSubmitReply(comment.id)} 
                disabled={!replyContent.trim()}
                style={{ 
                  padding: '6px 14px', 
                  background: replyContent.trim() ? '#1a73e8' : '#d1d5db', 
                  border: 'none', 
                  borderRadius: 4, 
                  color: 'white', 
                  cursor: replyContent.trim() ? 'pointer' : 'not-allowed', 
                  fontSize: 12,
                  fontWeight: 500
                }}
              >
                {t('reply')}
              </button>
              <button 
                onClick={onCancelReply} 
                style={{ 
                  padding: '6px 14px', 
                  background: 'transparent', 
                  border: 'none', 
                  borderRadius: 4, 
                  color: darkMode ? '#9ca3af' : '#5f6368', 
                  cursor: 'pointer', 
                  fontSize: 12 
                }}
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        ) : (
          <div 
            onClick={(e) => { e.stopPropagation(); onReply(comment.id); }}
            style={{ 
              marginTop: 12, 
              padding: '10px 12px', 
              background: darkMode ? '#333333' : '#f9fafb', 
              border: `1px solid ${darkMode ? '#555555' : '#e5e7eb'}`, 
              borderRadius: 20,
              color: '#9ca3af',
              fontSize: 12,
              cursor: 'text'
            }}
          >
            Répondez ou ajoutez d'autres personnes avec @
          </div>
        )
      )}
    </div>
  );
});

// ============ COMMENTS SIDEBAR (scrolls with content) ============
const CommentsSidebar = ({ comments, suggestions, elements, activeIndex, selectedCommentIndex, elementPositions, scrollContainerRef, scriptScrollHeight, token, docId, canComment, onClose, darkMode, t = (k) => k, onNavigateToElement, onAddComment, pendingInlineComment, onSubmitInlineComment, onCancelInlineComment, pendingSuggestion, onSubmitSuggestion, onCancelSuggestion, onAcceptSuggestion, onRejectSuggestion, selectedCommentId, onSelectComment, selectedSuggestionId, onSelectSuggestion, users, collaborators }) => {
  const [replyTo, setReplyTo] = useState(null);
  const [replyContent, setReplyContent] = useState('');
  const [, setNewCommentFor] = useState(null);
  const [newCommentText, setNewCommentText] = useState('');
  const [inlineCommentText, setInlineCommentText] = useState('');
  const [suggestionText, setSuggestionText] = useState('');
  const [filter, setFilter] = useState('all'); // 'all', 'comments', 'suggestions'
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);
  const inlineCommentInputRef = useRef(null);
  const suggestionInputRef = useRef(null);
  const fallbackRef = useRef(null);
  const sidebarRef = scrollContainerRef || fallbackRef; // Use external ref for scroll sync
  // eslint-disable-next-line no-unused-vars
  const commentRefs = useRef({});
  const prevActiveIndexRef = useRef(activeIndex);

  // Get unique users for mentions (online users + offline collaborators)
  const mentionableUsers = useMemo(() => {
    const allUsers = [];
    const seenNames = new Set();
    
    // Add online users first (with online indicator)
    if (users) {
      users.filter(u => u.name).forEach(u => {
        if (!seenNames.has(u.name.toLowerCase())) {
          seenNames.add(u.name.toLowerCase());
          allUsers.push({ name: u.name, color: u.color, online: true });
        }
      });
    }
    
    // Add offline collaborators
    if (collaborators) {
      collaborators.filter(c => c.name).forEach(c => {
        if (!seenNames.has(c.name.toLowerCase())) {
          seenNames.add(c.name.toLowerCase());
          allUsers.push({ name: c.name, color: c.color || '#6b7280', online: false });
        }
      });
    }
    
    return allUsers;
  }, [users, collaborators]);

  // Filter users based on search
  const filteredMentions = useMemo(() => {
    if (!mentionSearch) return mentionableUsers;
    return mentionableUsers.filter(u => 
      u.name.toLowerCase().includes(mentionSearch.toLowerCase())
    );
  }, [mentionableUsers, mentionSearch]);

  // Handle @ detection in comment text
  const handleCommentChange = (e) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart;
    setInlineCommentText(value);
    
    // Check if we're typing after @
    const textBeforeCursor = value.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@(\w*)$/);
    
    if (atMatch) {
      setShowMentions(true);
      setMentionSearch(atMatch[1]);
      setMentionIndex(0);
    } else {
      setShowMentions(false);
      setMentionSearch('');
    }
  };

  // Insert mention into text
  const insertMention = (userName) => {
    const textarea = inlineCommentInputRef.current;
    if (!textarea) return;
    
    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = inlineCommentText.slice(0, cursorPos);
    const textAfterCursor = inlineCommentText.slice(cursorPos);
    
    // Find the @ position
    const atMatch = textBeforeCursor.match(/@(\w*)$/);
    if (atMatch) {
      const beforeAt = textBeforeCursor.slice(0, -atMatch[0].length);
      const newText = beforeAt + '@' + userName + ' ' + textAfterCursor;
      setInlineCommentText(newText);
    }
    
    setShowMentions(false);
    setMentionSearch('');
    textarea.focus();
  };

  // Deselect comment/suggestion when clicking elsewhere in the script (activeIndex changes)
  useEffect(() => {
    if (activeIndex !== prevActiveIndexRef.current) {
      onSelectComment && onSelectComment(null);
      onSelectSuggestion && onSelectSuggestion(null);
      setReplyTo(null);
      prevActiveIndexRef.current = activeIndex;
    }
  }, [activeIndex, onSelectComment, onSelectSuggestion]);

  // Focus on inline comment input when pending comment appears
  const pendingCommentInitRef = useRef(null);
  useEffect(() => {
    if (pendingInlineComment && pendingInlineComment !== pendingCommentInitRef.current) {
      pendingCommentInitRef.current = pendingInlineComment;
      setInlineCommentText('');
      setTimeout(() => {
        inlineCommentInputRef.current?.focus();
      }, 100);
    } else if (!pendingInlineComment) {
      pendingCommentInitRef.current = null;
    }
  }, [pendingInlineComment]);

  // Focus on suggestion input when pending suggestion appears
  const pendingSuggestionInitRef = useRef(null);
  useEffect(() => {
    if (pendingSuggestion && pendingSuggestion !== pendingSuggestionInitRef.current) {
      pendingSuggestionInitRef.current = pendingSuggestion;
      setSuggestionText(pendingSuggestion.originalText || '');
      setTimeout(() => {
        suggestionInputRef.current?.focus();
        suggestionInputRef.current?.select();
      }, 100);
    } else if (!pendingSuggestion) {
      pendingSuggestionInitRef.current = null;
    }
  }, [pendingSuggestion]);

  const addReply = async (commentId) => {
    console.log('addReply called:', commentId, replyContent);
    if (!replyContent.trim()) return;
    try {
      const res = await fetch(SERVER_URL + '/api/documents/' + docId + '/comments/' + commentId + '/replies', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ content: replyContent }) });
      console.log('addReply response:', res.status);
      setReplyTo(null); setReplyContent('');
    } catch (err) { console.error('addReply error:', err); }
  };

  const toggleResolve = async (commentId) => {
    console.log('toggleResolve called:', commentId);
    try { 
      const res = await fetch(SERVER_URL + '/api/documents/' + docId + '/comments/' + commentId + '/resolve', { method: 'PUT', headers: { Authorization: 'Bearer ' + token } }); 
      console.log('toggleResolve response:', res.status);
    } catch (err) { console.error('toggleResolve error:', err); }
  };

  const deleteComment = async (commentId) => {
    console.log('deleteComment called:', commentId);
    try { 
      const res = await fetch(SERVER_URL + '/api/documents/' + docId + '/comments/' + commentId, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } }); 
      console.log('deleteComment response:', res.status);
    } catch (err) { console.error('deleteComment error:', err); }
  };

  const editComment = async (commentId, newContent) => {
    try { 
      await fetch(SERVER_URL + '/api/documents/' + docId + '/comments/' + commentId, { 
        method: 'PUT', 
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ content: newContent })
      }); 
    } catch (err) { console.error(err); }
  };

  // eslint-disable-next-line no-unused-vars
  const submitNewComment = async (elementId) => {
    if (!newCommentText.trim()) return;
    try {
      await fetch(SERVER_URL + '/api/documents/' + docId + '/comments', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ elementId, content: newCommentText }) });
      setNewCommentFor(null); setNewCommentText('');
    } catch (err) { console.error(err); }
  };

  // Group comments by element index (in document order)
  const commentsByElementIndex = useMemo(() => {
    const map = {};
    comments.filter(c => !c.resolved).forEach(c => {
      const elementIndex = elements.findIndex(el => el.id === c.elementId);
      if (elementIndex >= 0) {
        if (!map[elementIndex]) map[elementIndex] = [];
        map[elementIndex].push(c);
      }
    });
    return map;
  }, [comments, elements]);

  // Get element indices for suggestions - use elementId like comments for consistency when scenes are reordered
  const suggestionsByElementIndex = useMemo(() => {
    const map = {};
    if (suggestions) {
      suggestions.filter(s => s.status === 'pending').forEach(s => {
        // Use elementId to find current index (like comments), not stored elementIndex
        const idx = elements.findIndex(el => el.id === s.elementId);
        if (idx >= 0) {
          if (!map[idx]) map[idx] = [];
          map[idx].push(s);
        }
      });
    }
    return map;
  }, [suggestions, elements]);

  // Get sorted element indices that have comments OR suggestions
  const sortedIndices = useMemo(() => {
    const commentIndices = Object.keys(commentsByElementIndex).map(Number);
    const suggestionIndices = Object.keys(suggestionsByElementIndex).map(Number);
    const allIndices = [...new Set([...commentIndices, ...suggestionIndices])];
    return allIndices.sort((a, b) => a - b);
  }, [commentsByElementIndex, suggestionsByElementIndex]);

  const unresolvedComments = comments.filter(c => !c.resolved);
  const pendingSuggestions = suggestions ? suggestions.filter(s => s.status === 'pending') : [];
  
  // Detect Safari for performance optimizations
  const isSafariBrowser = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  }, []);
  
  // Track measured heights of each comment card
  const [cardHeights, setCardHeights] = useState({});
  const observersRef = useRef({});
  
  // Measure card height when rendered and observe for changes
  // On Safari: skip ResizeObserver entirely, use estimated heights
  const measureCard = useCallback((idx, element) => {
    // Clean up old observer
    if (observersRef.current[idx]) {
      observersRef.current[idx].disconnect();
      delete observersRef.current[idx];
    }
    
    if (element) {
      // Initial measurement
      const height = element.getBoundingClientRect().height;
      setCardHeights(prev => {
        if (prev[idx] !== height) {
          return { ...prev, [idx]: height };
        }
        return prev;
      });
      
      // On Safari, skip ResizeObserver to avoid performance issues
      if (isSafariBrowser) {
        return;
      }
      
      // Observe for size changes (e.g., when replies are added) - Chrome/Firefox only
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const newHeight = entry.contentRect.height + 20; // Add padding
          setCardHeights(prev => {
            if (prev[idx] !== newHeight) {
              return { ...prev, [idx]: newHeight };
            }
            return prev;
          });
        }
      });
      observer.observe(element);
      observersRef.current[idx] = observer;
    }
  }, [isSafariBrowser]);
  
  // Cleanup observers on unmount
  useEffect(() => {
    const observers = observersRef.current;
    return () => {
      Object.values(observers).forEach(obs => obs.disconnect());
    };
  }, []);
  
  // Calculate positions avoiding overlaps using actual measured heights
  // Reset offset if next comment is far away (more than ~2 pages)
  const adjustedPositions = useMemo(() => {
    const positions = {};
    const GAP = 15; // Gap between cards
    const RESET_THRESHOLD = 2000; // ~2 pages - if gap is larger, reset positioning
    let lastBottom = 0;
    
    sortedIndices.forEach(idx => {
      const idealTop = elementPositions[idx] || (idx * 30);
      
      // If this comment is far from the last one, reset the cascade
      // This prevents a few close comments from pushing ALL subsequent comments down
      if (idealTop - lastBottom > RESET_THRESHOLD) {
        lastBottom = 0; // Reset - this comment starts fresh at its ideal position
      }
      
      // Ensure this comment doesn't overlap with previous (within the same group)
      const actualTop = Math.max(idealTop, lastBottom);
      positions[idx] = actualTop;
      
      // Use measured height or estimate
      const cardHeight = cardHeights[idx] || 150;
      lastBottom = actualTop + cardHeight + GAP;
    });
    
    return positions;
  }, [sortedIndices, elementPositions, cardHeights]);

  // Calculate max content height for scroll spacer - must be at least as tall as script
  const maxContentHeight = useMemo(() => {
    let maxBottom = 0;
    sortedIndices.forEach(idx => {
      const top = adjustedPositions[idx] || 0;
      const height = cardHeights[idx] || 150;
      maxBottom = Math.max(maxBottom, top + height + 50);
    });
    // Also consider pending forms
    if (pendingInlineComment) {
      const pendingIdx = pendingInlineComment.elementIndex;
      const pendingTop = elementPositions[pendingIdx] || (pendingIdx * 30);
      maxBottom = Math.max(maxBottom, pendingTop + 200);
    }
    if (pendingSuggestion) {
      const pendingIdx = pendingSuggestion.elementIndex;
      const pendingTop = elementPositions[pendingIdx] || (pendingIdx * 30);
      maxBottom = Math.max(maxBottom, pendingTop + 200);
    }
    // Ensure at least as tall as script for 1:1 scroll sync
    return Math.max(maxBottom, scriptScrollHeight || 0);
  }, [sortedIndices, adjustedPositions, cardHeights, pendingInlineComment, pendingSuggestion, elementPositions, scriptScrollHeight]);

  // Navigation functions
  // Get filtered indices based on current filter
  const filteredSortedIndices = useMemo(() => {
    if (filter === 'all') return sortedIndices;
    if (filter === 'comments') {
      return Object.keys(commentsByElementIndex).map(Number).sort((a, b) => a - b);
    }
    if (filter === 'suggestions') {
      return Object.keys(suggestionsByElementIndex).map(Number).sort((a, b) => a - b);
    }
    return sortedIndices;
  }, [filter, sortedIndices, commentsByElementIndex, suggestionsByElementIndex]);

  const navigateToComment = (direction) => {
    if (filteredSortedIndices.length === 0) return;
    
    // Find current position in filteredSortedIndices based on activeIndex
    const currentPos = filteredSortedIndices.findIndex(idx => idx >= activeIndex);
    let targetPos;
    
    if (direction === 'next') {
      targetPos = currentPos === -1 ? 0 : Math.min(currentPos + 1, filteredSortedIndices.length - 1);
    } else {
      targetPos = currentPos <= 0 ? 0 : currentPos - 1;
    }
    
    const targetIdx = filteredSortedIndices[targetPos];
    if (targetIdx !== undefined && onNavigateToElement) {
      onNavigateToElement(targetIdx);
    }
  };

  return (
    <div 
      className="comments-sidebar"
      style={{ 
        flex: 1,
        display: 'flex', 
        flexDirection: 'column',
        background: darkMode ? '#333333' : '#f8f9fa', 
        overflow: 'hidden'
      }}
      onClick={() => { onSelectComment && onSelectComment(null); onSelectSuggestion && onSelectSuggestion(null); }}
    >
      {/* Header with navigation and filters */}
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {/* Comment filter button */}
          <button
            onClick={() => setFilter(f => f === 'comments' ? 'all' : 'comments')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 8px',
              background: filter === 'comments' || filter === 'all' ? (darkMode ? '#484848' : '#e5e7eb') : 'transparent',
              border: `1px solid ${filter === 'comments' ? '#1a73e8' : (darkMode ? '#555555' : '#d1d5db')}`,
              borderRadius: 4,
              color: filter === 'comments' ? '#1a73e8' : (darkMode ? 'white' : '#202124'),
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: filter === 'comments' ? 600 : 400
            }}
            title={t('filterComments')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
            </svg>
            {unresolvedComments.length}
          </button>
          
          {/* Suggestion filter button */}
          {pendingSuggestions.length > 0 && (
            <button
              onClick={() => setFilter(f => f === 'suggestions' ? 'all' : 'suggestions')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 8px',
                background: filter === 'suggestions' || filter === 'all' ? (darkMode ? '#484848' : '#e5e7eb') : 'transparent',
                border: `1px solid ${filter === 'suggestions' ? '#10b981' : (darkMode ? '#555555' : '#d1d5db')}`,
                borderRadius: 4,
                color: filter === 'suggestions' ? '#10b981' : (darkMode ? 'white' : '#202124'),
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: filter === 'suggestions' ? 600 : 400
              }}
              title={t('filterSuggestions')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
              </svg>
              {pendingSuggestions.length}
            </button>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {/* Navigation arrows */}
          <button 
            onClick={() => navigateToComment('prev')}
            disabled={filteredSortedIndices.length === 0}
            style={{ 
              background: 'none', 
              border: `1px solid ${darkMode ? '#555555' : '#d1d5db'}`, 
              borderRadius: 4,
              color: filteredSortedIndices.length === 0 ? '#6b7280' : (darkMode ? '#d1d5db' : '#484848'), 
              cursor: filteredSortedIndices.length === 0 ? 'not-allowed' : 'pointer', 
              fontSize: 14, 
              padding: '4px 8px',
              lineHeight: 1
            }}
            title={filter === 'suggestions' ? t('previousSuggestion') : t('previousComment')}
          >
            ↑
          </button>
          <button 
            onClick={() => navigateToComment('next')}
            disabled={filteredSortedIndices.length === 0}
            style={{ 
              background: 'none', 
              border: `1px solid ${darkMode ? '#555555' : '#d1d5db'}`, 
              borderRadius: 4,
              color: filteredSortedIndices.length === 0 ? '#6b7280' : (darkMode ? '#d1d5db' : '#484848'), 
              cursor: filteredSortedIndices.length === 0 ? 'not-allowed' : 'pointer', 
              fontSize: 14, 
              padding: '4px 8px',
              lineHeight: 1
            }}
            title={filter === 'suggestions' ? t('nextSuggestion') : t('nextComment')}
          >
            ↓
          </button>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 18, lineHeight: 1, marginLeft: 8 }}>✕</button>
        </div>
      </div>
      
      {/* Content area - allow scrolling */}
      <div 
        ref={sidebarRef}
        className="comments-sidebar-scroll-container"
        style={{ 
          flex: 1, 
          overflowY: 'auto',
          position: 'relative',
          padding: '8px 12px'
        }}
      >
        <div>
          
          {/* Pending inline comment form - Google Docs style */}
          {pendingInlineComment && (() => {
            const pendingIdx = pendingInlineComment.elementIndex;
            // Find if there are existing comments for this element
            const existingCommentsForElement = sortedIndices.includes(pendingIdx);
            let pendingTop;
            
            if (existingCommentsForElement) {
              // Position after the existing comment card
              const cardTop = adjustedPositions[pendingIdx] || elementPositions[pendingIdx] || (pendingIdx * 30);
              const cardHeight = cardHeights[pendingIdx] || 100;
              pendingTop = cardTop + cardHeight + 10;
            } else {
              // No existing comments - position at element level
              pendingTop = elementPositions[pendingIdx] || (pendingIdx * 30);
            }
            
            return (
              <div style={{ 
                position: 'absolute',
                top: 0,
                left: 8,
                right: 8,
                transform: `translateY(${pendingTop}px)`,
                background: darkMode ? '#484848' : 'white',
                borderRadius: 8,
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                border: `1px solid ${darkMode ? '#555555' : '#e5e7eb'}`,
                zIndex: 10,
                overflow: 'hidden'
              }}>
                {/* Highlighted text banner */}
                <div style={{ 
                  background: 'rgba(251, 191, 36, 0.2)', 
                  padding: '8px 12px',
                  borderBottom: `1px solid ${darkMode ? '#555555' : '#fbbf24'}`,
                  fontSize: 12,
                  color: darkMode ? '#fbbf24' : '#92400e',
                  fontStyle: 'italic'
                }}>
                  "{pendingInlineComment.text.slice(0, 60)}{pendingInlineComment.text.length > 60 ? '...' : ''}"
                </div>
                
                <div style={{ padding: 12, position: 'relative' }}>
                  <textarea
                    ref={inlineCommentInputRef}
                    value={inlineCommentText}
                    onChange={handleCommentChange}
                    placeholder="Ajouter un commentaire... (@mention)"
                    onKeyDown={(e) => {
                      // Handle mention navigation
                      if (showMentions && filteredMentions.length > 0) {
                        if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          setMentionIndex(i => Math.min(i + 1, filteredMentions.length - 1));
                          return;
                        }
                        if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          setMentionIndex(i => Math.max(i - 1, 0));
                          return;
                        }
                        if (e.key === 'Enter' || e.key === 'Tab') {
                          e.preventDefault();
                          insertMention(filteredMentions[mentionIndex].name);
                          return;
                        }
                        if (e.key === 'Escape') {
                          setShowMentions(false);
                          return;
                        }
                      }
                      
                      if (e.key === 'Enter' && !e.shiftKey && inlineCommentText.trim() && !showMentions) {
                        e.preventDefault();
                        e.stopPropagation();
                        onSubmitInlineComment(inlineCommentText);
                        setInlineCommentText('');
                      }
                      if (e.key === 'Escape' && !showMentions) {
                        e.stopPropagation();
                        onCancelInlineComment();
                        setInlineCommentText('');
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: 10,
                      border: `1px solid ${darkMode ? '#555555' : '#e5e7eb'}`,
                      borderRadius: 6,
                      fontSize: 13,
                      resize: 'none',
                      minHeight: 60,
                      background: darkMode ? '#333333' : '#f9fafb',
                      color: darkMode ? 'white' : '#484848',
                      boxSizing: 'border-box'
                    }}
                  />
                  
                  {/* Mentions dropdown */}
                  {showMentions && filteredMentions.length > 0 && (
                    <div style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: 12,
                      right: 12,
                      marginBottom: -8,
                      background: darkMode ? '#484848' : 'white',
                      border: `1px solid ${darkMode ? '#555555' : '#d1d5db'}`,
                      borderRadius: 6,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      maxHeight: 150,
                      overflow: 'auto',
                      zIndex: 10
                    }}>
                      {filteredMentions.map((user, idx) => (
                        <div
                          key={user.name}
                          onClick={() => insertMention(user.name)}
                          style={{
                            padding: '8px 12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            cursor: 'pointer',
                            background: idx === mentionIndex ? (darkMode ? '#555555' : '#f3f4f6') : 'transparent'
                          }}
                          onMouseEnter={() => setMentionIndex(idx)}
                        >
                          <div style={{
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            background: user.color || '#3b82f6',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontSize: 10,
                            fontWeight: 'bold',
                            position: 'relative'
                          }}>
                            {user.name.charAt(0).toUpperCase()}
                            {/* Online indicator */}
                            <span style={{
                              position: 'absolute',
                              bottom: -1,
                              right: -1,
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background: user.online ? '#22c55e' : '#6b7280',
                              border: `2px solid ${darkMode ? '#484848' : 'white'}`
                            }} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <span style={{ fontSize: 13, color: darkMode ? 'white' : '#484848' }}>
                              {user.name}
                            </span>
                            {!user.online && (
                              <span style={{ fontSize: 10, color: '#6b7280', marginLeft: 6 }}>
                                (hors ligne)
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => {
                        onCancelInlineComment();
                        setInlineCommentText('');
                      }}
                      style={{
                        padding: '8px 16px',
                        background: 'transparent',
                        color: darkMode ? '#9ca3af' : '#5f6368',
                        border: 'none',
                        borderRadius: 4,
                        fontSize: 13,
                        cursor: 'pointer'
                      }}
                    >
                      {t('cancel')}
                    </button>
                    <button
                      onClick={() => {
                        if (inlineCommentText.trim()) {
                          onSubmitInlineComment(inlineCommentText);
                          setInlineCommentText('');
                        }
                      }}
                      disabled={!inlineCommentText.trim()}
                      style={{
                        padding: '8px 16px',
                        background: inlineCommentText.trim() ? '#1a73e8' : '#d1d5db',
                        color: 'white',
                        border: 'none',
                        borderRadius: 4,
                        fontSize: 13,
                        cursor: inlineCommentText.trim() ? 'pointer' : 'not-allowed',
                        fontWeight: 500
                      }}
                    >
                      Commenter
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
          
          {/* Pending suggestion form */}
          {pendingSuggestion && (() => {
            const pendingIdx = pendingSuggestion.elementIndex;
            const existingCommentsForElement = sortedIndices.includes(pendingIdx);
            let pendingTop;
            
            if (existingCommentsForElement) {
              const cardTop = adjustedPositions[pendingIdx] || elementPositions[pendingIdx] || (pendingIdx * 30);
              const cardHeight = cardHeights[pendingIdx] || 100;
              pendingTop = cardTop + cardHeight + 10;
            } else {
              pendingTop = elementPositions[pendingIdx] || (pendingIdx * 30);
            }
            
            return (
              <div style={{ 
                position: 'absolute',
                top: 0,
                left: 8,
                right: 8,
                transform: `translateY(${pendingTop}px)`,
                background: darkMode ? '#484848' : 'white',
                borderRadius: 8,
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                border: `2px solid #10b981`,
                zIndex: 10,
                overflow: 'hidden'
              }}>
                {/* Header */}
                <div style={{ 
                  background: 'rgba(16, 185, 129, 0.1)', 
                  padding: '8px 12px',
                  borderBottom: `1px solid ${darkMode ? '#555555' : '#10b981'}`,
                  fontSize: 12,
                  color: '#10b981',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
                  </svg>
                  Proposer une modification
                </div>
                
                <div style={{ padding: 12 }}>
                  {/* Original text (strikethrough) */}
                  <div style={{ marginBottom: 8 }}>
                    <span style={{ fontSize: 11, color: '#6b7280' }}>Texte original :</span>
                    <div style={{ 
                      textDecoration: 'line-through', 
                      color: '#ef4444', 
                      fontSize: 13,
                      background: 'rgba(239, 68, 68, 0.1)',
                      padding: '4px 8px',
                      borderRadius: 4,
                      marginTop: 4
                    }}>
                      {pendingSuggestion.originalText}
                    </div>
                  </div>
                  
                  {/* Suggested text input */}
                  <div style={{ marginBottom: 8 }}>
                    <span style={{ fontSize: 11, color: '#6b7280' }}>{t('replaceBy')}</span>
                    <textarea
                      ref={suggestionInputRef}
                      value={suggestionText}
                      onChange={(e) => setSuggestionText(e.target.value)}
                      placeholder={t('typeSuggestion')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          onSubmitSuggestion(suggestionText);
                          setSuggestionText('');
                        }
                        if (e.key === 'Escape') {
                          onCancelSuggestion();
                          setSuggestionText('');
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: 10,
                        border: `2px solid #10b981`,
                        borderRadius: 6,
                        fontSize: 13,
                        resize: 'none',
                        minHeight: 50,
                        background: darkMode ? '#333333' : '#f0fdf4',
                        color: darkMode ? '#6ee7b7' : '#166534',
                        boxSizing: 'border-box',
                        marginTop: 4
                      }}
                    />
                  </div>
                  
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => {
                        onCancelSuggestion();
                        setSuggestionText('');
                      }}
                      style={{
                        padding: '8px 16px',
                        background: 'transparent',
                        color: darkMode ? '#9ca3af' : '#5f6368',
                        border: 'none',
                        borderRadius: 4,
                        fontSize: 13,
                        cursor: 'pointer'
                      }}
                    >
                      {t('cancel')}
                    </button>
                    <button
                      onClick={() => {
                        onSubmitSuggestion(suggestionText);
                        setSuggestionText('');
                      }}
                      style={{
                        padding: '8px 16px',
                        background: '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: 4,
                        fontSize: 13,
                        cursor: 'pointer',
                        fontWeight: 500
                      }}
                    >
                      Suggérer
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
          
          {sortedIndices.length === 0 && !pendingInlineComment && !pendingSuggestion ? (
            <p style={{ color: '#6b7280', textAlign: 'center', padding: 20, fontSize: 12 }}>{t('noCommentsOrSuggestions')}</p>
          ) : sortedIndices.length > 0 ? (
            sortedIndices.map((idx, arrayIndex) => {
              const elementComments = commentsByElementIndex[idx] || [];
              const topPosition = adjustedPositions[idx] || 0;
              
              return (
                <div 
                  key={idx}
                  data-comment-element-index={idx}
                  ref={(el) => measureCard(idx, el)}
                  style={{ 
                    position: 'absolute',
                    top: 0,
                    left: 8,
                    right: 8,
                    transform: `translateY(${topPosition}px)`
                  }}
                >
                  {/* Comments for this element */}
                  {(filter === 'all' || filter === 'comments') && elementComments.map(c => {
                    const cId = String(c.id || c._id);
                    const isThisCommentSelected = String(selectedCommentId) === cId || (selectedCommentIndex === idx && elementComments.length === 1);
                    return (
                      <div 
                        key={cId} 
                        data-comment-id={cId}
                        data-comment-card-id={cId}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectComment && onSelectComment(isThisCommentSelected ? null : cId);
                          if (!isThisCommentSelected) {
                            onNavigateToElement && onNavigateToElement(idx);
                          }
                        }}
                      >
                        <InlineComment 
                          comment={{...c, id: cId}} 
                          onReply={id => { setReplyTo(replyTo === id ? null : id); setReplyContent(''); }}
                          onResolve={toggleResolve}
                          onDelete={deleteComment}
                          onEdit={editComment}
                          canComment={canComment}
                          isReplying={replyTo === cId}
                          replyContent={replyTo === cId ? replyContent : ''}
                          onReplyChange={setReplyContent}
                          onSubmitReply={addReply}
                          onCancelReply={() => { setReplyTo(null); setReplyContent(''); }}
                          darkMode={darkMode}
                          isSelected={isThisCommentSelected}
                          mentionableUsers={mentionableUsers}
                          t={t}
                        />
                      </div>
                    );
                  })}
                  
                  {/* Suggestions for this element */}
                  {(filter === 'all' || filter === 'suggestions') && suggestions && suggestions
                    .filter(s => s.elementIndex === idx && s.status === 'pending')
                    .map(s => {
                      const sId = String(s.id || s._id);
                      const isSelected = String(selectedSuggestionId) === sId;
                      const timeAgo = s.createdAt ? new Date(s.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '';
                      
                      return (
                        <div 
                          key={sId}
                          data-suggestion-id={sId}
                          data-suggestion-card-id={sId}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectSuggestion && onSelectSuggestion(isSelected ? null : sId);
                            // Navigate to the element in the script
                            if (!isSelected && onNavigateToElement) {
                              onNavigateToElement(s.elementIndex);
                            }
                          }}
                          style={{
                            background: darkMode ? '#333333' : '#f0fdf4',
                            borderRadius: 8,
                            padding: isSelected ? 12 : 10,
                            marginBottom: 6,
                            boxShadow: isSelected ? '0 2px 8px rgba(0,0,0,0.15)' : '0 1px 3px rgba(0,0,0,0.08)',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            borderLeft: '3px solid #10b981'
                          }}
                        >
                          {/* Header - always visible */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ 
                              width: 24, 
                              height: 24, 
                              borderRadius: '50%', 
                              background: s.userColor || '#10b981', 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center', 
                              color: 'white', 
                              fontWeight: 'bold', 
                              fontSize: 10,
                              flexShrink: 0
                            }}>
                              {s.userName?.charAt(0).toUpperCase()}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ color: darkMode ? 'white' : '#333333', fontWeight: 600, fontSize: 12 }}>{s.userName}</span>
                                <span style={{ color: '#6b7280', fontSize: 11 }}>{timeAgo}</span>
                              </div>
                              {/* Compact view - one line description */}
                              {!isSelected && (
                                <div style={{ fontSize: 12, color: darkMode ? '#9ca3af' : '#555555', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  <strong>{t('replaceLabel')}</strong> <span style={{ fontStyle: 'italic' }}>"{s.originalText.substring(0, 20)}{s.originalText.length > 20 ? '...' : ''}"</span> {t('by')} <span style={{ fontStyle: 'italic' }}>"{s.suggestedText.substring(0, 20)}{s.suggestedText.length > 20 ? '...' : ''}"</span>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Expanded view */}
                          {isSelected && (
                            <>
                              <div style={{ fontSize: 13, margin: '12px 0' }}>
                                <div style={{ color: '#6b7280', fontSize: 11, marginBottom: 4, fontWeight: 500 }}>{t('replaceLabel')}</div>
                                <div style={{ 
                                  textDecoration: 'line-through', 
                                  color: '#dc2626',
                                  marginBottom: 6,
                                  fontSize: 13
                                }}>
                                  "{s.originalText}"
                                </div>
                                <div style={{ color: '#6b7280', fontSize: 11, marginBottom: 4, fontWeight: 500 }}>Par :</div>
                                <div style={{ 
                                  color: '#16a34a',
                                  fontWeight: 500,
                                  fontSize: 13
                                }}>
                                  "{s.suggestedText}"
                                </div>
                              </div>
                              
                              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                <button
                                  onClick={(e) => { e.stopPropagation(); onRejectSuggestion && onRejectSuggestion(sId); }}
                                  style={{
                                    padding: '6px 12px',
                                    background: 'transparent',
                                    border: `1px solid ${darkMode ? '#555555' : '#d1d5db'}`,
                                    borderRadius: 4,
                                    color: darkMode ? '#9ca3af' : '#6b7280',
                                    fontSize: 12,
                                    cursor: 'pointer'
                                  }}
                                >
                                  {t('reject')}
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); onAcceptSuggestion && onAcceptSuggestion(sId); }}
                                  style={{
                                    padding: '6px 12px',
                                    background: '#10b981',
                                    border: 'none',
                                    borderRadius: 4,
                                    color: 'white',
                                    fontSize: 12,
                                    cursor: 'pointer',
                                    fontWeight: 500
                                  }}
                                >
                                  ✓ {t('accept')}
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })
                  }
                </div>
              );
            })
          ) : null}
          
          {/* Spacer to ensure sidebar can scroll to full document height */}
          <div style={{ height: maxContentHeight, pointerEvents: 'none' }} />
        </div>
      </div>
    </div>
  );
};

// ============ CHARACTERS PANEL ============
const CharactersPanel = ({ characterStats, darkMode, onClose, onNavigate }) => {
  return (
    <div style={{ 
      position: 'fixed', 
      right: 0, 
      top: 60, 
      bottom: 0, 
      width: 320, 
      background: darkMode ? '#333333' : 'white', 
      borderLeft: `1px solid ${darkMode ? '#484848' : '#d1d5db'}`, 
      zIndex: 100, 
      display: 'flex', 
      flexDirection: 'column',
      boxShadow: '-4px 0 20px rgba(0,0,0,0.2)'
    }}>
      <div style={{ padding: 16, borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: 16, color: darkMode ? 'white' : 'black', display: 'flex', alignItems: 'center', gap: 8 }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>Personnages</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>✕</button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
        {characterStats.length === 0 ? (
          <p style={{ color: '#6b7280', textAlign: 'center', padding: 20, fontSize: 13 }}>Aucun personnage</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}` }}>
                <th style={{ textAlign: 'left', padding: '8px 4px', color: darkMode ? '#9ca3af' : '#6b7280', fontWeight: 600 }}>Personnage</th>
                <th style={{ textAlign: 'center', padding: '8px 4px', color: darkMode ? '#9ca3af' : '#6b7280', fontWeight: 600 }}>Répliques</th>
                <th style={{ textAlign: 'center', padding: '8px 4px', color: darkMode ? '#9ca3af' : '#6b7280', fontWeight: 600 }}>Scènes</th>
                <th style={{ textAlign: 'center', padding: '8px 4px', color: darkMode ? '#9ca3af' : '#6b7280', fontWeight: 600 }}>1ère app.</th>
              </tr>
            </thead>
            <tbody>
              {characterStats.map((char, idx) => (
                <tr 
                  key={char.name} 
                  onClick={() => onNavigate(char.firstIndex)}
                  style={{ 
                    borderBottom: `1px solid ${darkMode ? '#484848' : '#f3f4f6'}`,
                    cursor: 'pointer',
                    background: idx % 2 === 0 ? 'transparent' : (darkMode ? '#484848' : '#f9fafb')
                  }}
                >
                  <td style={{ padding: '10px 4px', color: darkMode ? 'white' : 'black', fontWeight: 500 }}>{char.name}</td>
                  <td style={{ padding: '10px 4px', textAlign: 'center', color: darkMode ? '#d1d5db' : '#484848' }}>{char.lines}</td>
                  <td style={{ padding: '10px 4px', textAlign: 'center', color: darkMode ? '#d1d5db' : '#484848' }}>{char.sceneCount}</td>
                  <td style={{ padding: '10px 4px', textAlign: 'center', color: darkMode ? '#9ca3af' : '#6b7280' }}>Sc. {char.firstAppearance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div style={{ padding: 12, borderTop: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, fontSize: 12, color: '#6b7280', textAlign: 'center' }}>
        {characterStats.length} personnage{characterStats.length > 1 ? 's' : ''} • {characterStats.reduce((a, c) => a + c.lines, 0)} répliques
      </div>
    </div>
  );
};

// ============ NOTE EDITOR MODAL ============
const NoteEditorModal = ({ elementId, note, onSave, onPushToComment, onClose, darkMode, canPush, position, onDragStart, t = (k) => k }) => {
  const [content, setContent] = useState(note?.content || '');
  const [color, setColor] = useState(note?.color || '#fef3c7');
  const colors = ['#fef3c7', '#dcfce7', '#dbeafe', '#fce7f3', '#f3e8ff'];

  return (
    <div 
      style={{ 
        position: 'fixed', 
        left: position?.x || '50%',
        top: position?.y || '50%',
        transform: position ? 'none' : 'translate(-50%, -50%)',
        background: darkMode ? '#333333' : 'white', 
        borderRadius: 12, 
        width: 380, 
        boxShadow: '0 25px 50px rgba(0,0,0,0.4)',
        zIndex: 500,
        overflow: 'hidden'
      }}
    >
      {/* Draggable header */}
      <div 
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          padding: '12px 16px',
          background: darkMode ? '#484848' : '#f3f4f6',
          cursor: 'move',
          userSelect: 'none'
        }}
        onMouseDown={onDragStart}
      >
        <h3 style={{ margin: 0, fontSize: 16, color: darkMode ? 'white' : 'black', display: 'flex', alignItems: 'center', gap: 8 }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Note personnelle</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>✕</button>
      </div>
      
      <div style={{ padding: '16px 20px' }}>
        <textarea 
          autoFocus
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Votre note (visible uniquement par vous)..."
          style={{ 
            width: '100%', 
            padding: 12, 
            background: color, 
            border: `1px solid ${darkMode ? '#484848' : '#d1d5db'}`, 
            borderRadius: 8, 
            color: '#484848', 
            fontSize: 14, 
            resize: 'none', 
            boxSizing: 'border-box',
            minHeight: 100
          }}
          rows={4}
        />
        
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          {colors.map(c => (
            <button 
              key={c}
              onClick={() => setColor(c)}
              style={{ 
                width: 26, 
                height: 26, 
                borderRadius: 6, 
                background: c, 
                border: color === c ? '2px solid #2563eb' : '1px solid #d1d5db',
                cursor: 'pointer'
              }}
            />
          ))}
        </div>
        
        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button 
              onClick={() => onSave(elementId, content, color)} 
              style={{ padding: '8px 16px', background: '#2563eb', border: 'none', borderRadius: 6, color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
            >
              {t('save')}
            </button>
            {note && (
              <button 
                onClick={() => onSave(elementId, '', '')} 
                style={{ padding: '8px 16px', background: '#ef4444', border: 'none', borderRadius: 6, color: 'white', cursor: 'pointer', fontSize: 13 }}
              >
                {t('delete')}
              </button>
            )}
          </div>
          {note && canPush && (
            <button 
              onClick={() => onPushToComment(elementId)} 
              style={{ padding: '8px 12px', background: '#059669', border: 'none', borderRadius: 6, color: 'white', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
            >
              💬 Publier
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ============ STATS PANEL ============
const StatsPanel = ({ stats, elements, onClose, darkMode }) => {
  // Calculate additional stats
  const characters = useMemo(() => {
    const counts = {};
    elements.forEach(el => {
      const t = stripHtml(el.content).trim();
      if (el.type === 'character' && t) {
        const name = t.replace(/\s*\(.*?\)\s*/g, '').toUpperCase();
        counts[name] = (counts[name] || 0) + 1;
      }
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [elements]);

  const locations = useMemo(() => {
    const counts = { INT: 0, EXT: 0 };
    elements.forEach(el => {
      const t = stripHtml(el.content);
      if (el.type === 'scene' && t) {
        if (t.match(/^INT[.\s]/i)) counts.INT++;
        else if (t.match(/^EXT[.\s]/i)) counts.EXT++;
      }
    });
    return counts;
  }, [elements]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500 }} onClick={onClose}>
      <div style={{ background: darkMode ? '#333333' : 'white', borderRadius: 12, padding: 24, width: '100%', maxWidth: 450, maxHeight: '80vh', overflow: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 20, color: darkMode ? 'white' : 'black', display: 'flex', alignItems: 'center', gap: 8 }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>Statistiques</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>✕</button>
        </div>
        
        {/* Main stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
          <div style={{ background: darkMode ? '#484848' : '#f3f4f6', padding: 16, borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 'bold', color: darkMode ? 'white' : 'black' }}>{stats.words}</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Mots</div>
          </div>
          <div style={{ background: darkMode ? '#484848' : '#f3f4f6', padding: 16, borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 'bold', color: darkMode ? 'white' : 'black' }}>{stats.scenes}</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Scènes</div>
          </div>
          <div style={{ background: darkMode ? '#484848' : '#f3f4f6', padding: 16, borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 'bold', color: darkMode ? 'white' : 'black' }}>{characters.length}</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Personnages</div>
          </div>
        </div>
        
        {/* Time estimates */}
        <div style={{ background: darkMode ? '#484848' : '#f3f4f6', padding: 16, borderRadius: 8, marginBottom: 20 }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: 14, color: darkMode ? 'white' : 'black', display: 'flex', alignItems: 'center', gap: 6 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>Estimations</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 'bold', color: darkMode ? 'white' : 'black' }}>~{stats.screenTimeMin} min</div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>Durée à l'écran</div>
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 'bold', color: darkMode ? 'white' : 'black' }}>{stats.dialogueRatio}%</div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>Dialogues</div>
            </div>
          </div>
        </div>
        
        {/* INT/EXT breakdown */}
        <div style={{ background: darkMode ? '#484848' : '#f3f4f6', padding: 16, borderRadius: 8, marginBottom: 20 }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: 14, color: darkMode ? 'white' : 'black' }}>📍 Lieux</h4>
          <div style={{ display: 'flex', gap: 20 }}>
            <div>
              <span style={{ fontSize: 18, fontWeight: 'bold', color: darkMode ? 'white' : 'black' }}>{locations.INT}</span>
              <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 6 }}>INT.</span>
            </div>
            <div>
              <span style={{ fontSize: 18, fontWeight: 'bold', color: darkMode ? 'white' : 'black' }}>{locations.EXT}</span>
              <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 6 }}>EXT.</span>
            </div>
          </div>
          {(locations.INT + locations.EXT > 0) && (
            <div style={{ marginTop: 10, height: 6, background: darkMode ? '#555555' : '#d1d5db', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(locations.INT / (locations.INT + locations.EXT)) * 100}%`, background: '#3b82f6', borderRadius: 3 }} />
            </div>
          )}
        </div>
        
        {/* Top characters */}
        {characters.length > 0 && (
          <div style={{ background: darkMode ? '#484848' : '#f3f4f6', padding: 16, borderRadius: 8 }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: 14, color: darkMode ? 'white' : 'black', display: 'flex', alignItems: 'center', gap: 6 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>Top personnages</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {characters.slice(0, 5).map(([name, count]) => (
                <div key={name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: darkMode ? 'white' : 'black' }}>{name}</span>
                  <span style={{ color: '#6b7280' }}>{count} répliques</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ============ GO TO SCENE MODAL ============
const GoToSceneModal = ({ onClose, onGoTo, maxScene, darkMode }) => {
  const [sceneNum, setSceneNum] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleGo = () => {
    const num = parseInt(sceneNum);
    if (num >= 1 && num <= maxScene) {
      onGoTo(num);
      onClose();
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500 }} onClick={onClose}>
      <div style={{ background: darkMode ? '#333333' : 'white', borderRadius: 12, padding: 24, width: '100%', maxWidth: 300, boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: 18, color: darkMode ? 'white' : 'black', display: 'flex', alignItems: 'center', gap: 8 }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>Aller à la scène</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            ref={inputRef}
            type="number"
            min="1"
            max={maxScene}
            value={sceneNum}
            onChange={e => setSceneNum(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleGo()}
            placeholder={`1 - ${maxScene}`}
            style={{ flex: 1, padding: '10px 12px', borderRadius: 6, border: `1px solid ${darkMode ? '#555555' : '#d1d5db'}`, background: darkMode ? '#484848' : 'white', color: darkMode ? 'white' : 'black', fontSize: 16 }}
          />
          <button onClick={handleGo} style={{ padding: '10px 16px', background: '#3b82f6', border: 'none', borderRadius: 6, color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>Go</button>
        </div>
        <p style={{ margin: '12px 0 0 0', fontSize: 12, color: '#6b7280' }}>{maxScene} scène{maxScene > 1 ? 's' : ''} au total</p>
      </div>
    </div>
  );
};

// ============ WRITING GOALS MODAL ============
// eslint-disable-next-line no-unused-vars
const WritingGoalsModal = ({ goal, onUpdate, onClose, currentWords, darkMode }) => {
  const [dailyGoal, setDailyGoal] = useState(goal.daily);
  const progress = Math.min(100, Math.round((goal.todayWords / goal.daily) * 100));

  const handleSave = () => {
    onUpdate({ ...goal, daily: parseInt(dailyGoal) || 1000 });
    onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500 }} onClick={onClose}>
      <div style={{ background: darkMode ? '#333333' : 'white', borderRadius: 12, padding: 24, width: '100%', maxWidth: 400, boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 18, color: darkMode ? 'white' : 'black', display: 'flex', alignItems: 'center', gap: 8 }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>Objectif d'écriture</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 20 }}>✕</button>
        </div>

        {/* Progress bar */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 14, color: darkMode ? 'white' : 'black' }}>Aujourd'hui</span>
            <span style={{ fontSize: 14, color: progress >= 100 ? '#22c55e' : '#6b7280' }}>{goal.todayWords} / {goal.daily} mots</span>
          </div>
          <div style={{ height: 8, background: darkMode ? '#484848' : '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: progress >= 100 ? '#22c55e' : '#3b82f6', borderRadius: 4, transition: 'width 0.3s' }} />
          </div>
          <p style={{ margin: '8px 0 0 0', fontSize: 12, color: progress >= 100 ? '#22c55e' : '#6b7280', textAlign: 'center' }}>
            {progress >= 100 ? '🎉 Objectif atteint !' : `${progress}% - ${goal.daily - goal.todayWords} mots restants`}
          </p>
        </div>

        {/* Goal setting */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280' }}>Objectif quotidien (mots)</label>
          <input
            type="number"
            min="100"
            step="100"
            value={dailyGoal}
            onChange={e => setDailyGoal(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: `1px solid ${darkMode ? '#555555' : '#d1d5db'}`, background: darkMode ? '#484848' : 'white', color: darkMode ? 'white' : 'black', fontSize: 14 }}
          />
        </div>

        {/* Quick presets */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {[500, 1000, 1500, 2000].map(preset => (
            <button
              key={preset}
              onClick={() => setDailyGoal(preset)}
              style={{ flex: 1, padding: '8px', background: Number(dailyGoal) === preset ? '#3b82f6' : (darkMode ? '#484848' : '#f3f4f6'), border: 'none', borderRadius: 6, color: Number(dailyGoal) === preset ? 'white' : (darkMode ? 'white' : 'black'), cursor: 'pointer', fontSize: 12 }}
            >
              {preset}
            </button>
          ))}
        </div>

        <button onClick={handleSave} style={{ width: '100%', padding: '12px', background: '#22c55e', border: 'none', borderRadius: 6, color: 'white', cursor: 'pointer', fontWeight: 'bold', fontSize: 14 }}>
          Enregistrer
        </button>
      </div>
    </div>
  );
};

// ============ SHORTCUTS PANEL ============
const ShortcutsPanel = ({ onClose, darkMode }) => {
  const shortcuts = [
    { category: 'Navigation', items: [
      { keys: '⌘↑', desc: 'Élément précédent' },
      { keys: '⌘↓', desc: 'Élément suivant' },
      { keys: '⌘O', desc: 'Ouvrir/Fermer Outline' },
      { keys: '⌘G', desc: 'Aller à la scène' },
    ]},
    { category: 'Édition', items: [
      { keys: '⌘Z', desc: 'Annuler' },
      { keys: '⌘⇧Z', desc: 'Rétablir' },
      { keys: '⌘S', desc: 'Créer un snapshot' },
      { keys: '⌘D', desc: 'Dupliquer la scène' },
      { keys: '⌘F', desc: 'Rechercher/Remplacer' },
      { keys: '⌘N', desc: 'Ajouter une note' },
      { keys: 'Tab', desc: 'Changer type élément' },
      { keys: 'Backspace', desc: 'Supprimer ligne vide' },
    ]},
    { category: 'Types (⌘+chiffre)', items: [
      { keys: '⌘1', desc: 'Scène' },
      { keys: '⌘2', desc: 'Action' },
      { keys: '⌘3', desc: 'Personnage' },
      { keys: '⌘4', desc: 'Dialogue' },
      { keys: '⌘5', desc: 'Parenthèse' },
      { keys: '⌘6', desc: 'Transition' },
    ]},
    { category: 'Beat Board', items: [
      { keys: 'B', desc: 'Ouvrir Beat Board' },
      { keys: '⌘B', desc: 'Basculer Script/Beat Board' },
      { keys: 'Escape', desc: 'Fermer Beat Board' },
    ]},
    { category: 'Général', items: [
      { keys: 'Escape', desc: 'Fermer panel actif' },
      { keys: '⌘?', desc: 'Raccourcis clavier' },
      { keys: '⌘.', desc: 'Mode focus' },
    ]},
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500 }} onClick={onClose}>
      <div style={{ background: darkMode ? '#333333' : 'white', borderRadius: 12, padding: 24, width: '100%', maxWidth: 500, maxHeight: '80vh', overflow: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 20, color: darkMode ? 'white' : 'black', display: 'flex', alignItems: 'center', gap: 8 }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" ry="2"/><path d="M6 8h.001"/><path d="M10 8h.001"/><path d="M14 8h.001"/><path d="M18 8h.001"/><path d="M8 12h.001"/><path d="M12 12h.001"/><path d="M16 12h.001"/><path d="M7 16h10"/></svg>Raccourcis clavier</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>✕</button>
        </div>
        
        {shortcuts.map(cat => (
          <div key={cat.category} style={{ marginBottom: 20 }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: 13, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1 }}>{cat.category}</h4>
            <div style={{ display: 'grid', gap: 6 }}>
              {cat.items.map(item => (
                <div key={item.keys} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: darkMode ? '#484848' : '#f3f4f6', borderRadius: 6 }}>
                  <span style={{ fontSize: 13, color: darkMode ? 'white' : 'black' }}>{item.desc}</span>
                  <kbd style={{ 
                    padding: '4px 8px', 
                    background: darkMode ? '#555555' : 'white', 
                    border: `1px solid ${darkMode ? '#6b7280' : '#d1d5db'}`, 
                    borderRadius: 4, 
                    fontSize: 12, 
                    fontFamily: 'monospace',
                    color: darkMode ? '#e5e7eb' : '#484848'
                  }}>{item.keys}</kbd>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============ RENAME CHARACTER MODAL ============
const RenameCharacterModal = ({ characters, onRename, onClose, darkMode, t = (k) => k }) => {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const handleRename = () => {
    if (from && to && from !== to) {
      onRename(from, to);
    }
  };

  const charList = [...new Set(characters)].sort();

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500 }} onClick={onClose}>
      <div style={{ background: darkMode ? '#333333' : 'white', borderRadius: 12, padding: 24, width: '100%', maxWidth: 400, boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 18, color: darkMode ? 'white' : 'black', display: 'flex', alignItems: 'center', gap: 8 }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>{t('renameCharacterTitle')}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>✕</button>
        </div>
        
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280' }}>{t('oldName')}</label>
          <select 
            value={from} 
            onChange={e => setFrom(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '10px 28px 10px 12px', 
              background: darkMode ? '#484848' : 'white', 
              border: `1px solid ${darkMode ? '#555555' : '#d1d5db'}`, 
              borderRadius: 6, 
              color: darkMode ? 'white' : 'black', 
              fontSize: 14,
              cursor: 'pointer',
              outline: 'none',
              WebkitAppearance: 'none',
              MozAppearance: 'none',
              appearance: 'none',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='${darkMode ? '%239ca3af' : '%236b7280'}' d='M3 5l3 3 3-3'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 10px center'
            }}
          >
            <option value="">Sélectionner...</option>
            {charList.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280' }}>{t('newName')}</label>
          <input 
            type="text"
            value={to} 
            onChange={e => setTo(e.target.value.toUpperCase())}
            placeholder="NOUVEAU NOM"
            style={{ 
              width: '100%', 
              padding: '10px 12px', 
              background: darkMode ? '#484848' : 'white', 
              border: `1px solid ${darkMode ? '#555555' : '#d1d5db'}`, 
              borderRadius: 6, 
              color: darkMode ? 'white' : 'black', 
              fontSize: 14,
              boxSizing: 'border-box'
            }}
          />
        </div>
        
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '10px 20px', background: 'transparent', border: `1px solid ${darkMode ? '#555555' : '#d1d5db'}`, borderRadius: 6, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 14 }}>
            {t('cancel')}
          </button>
          <button 
            onClick={handleRename} 
            disabled={!from || !to || from === to}
            style={{ padding: '10px 20px', background: (!from || !to || from === to) ? '#6b7280' : '#2563eb', border: 'none', borderRadius: 6, color: 'white', cursor: (!from || !to || from === to) ? 'default' : 'pointer', fontSize: 14, fontWeight: 500 }}
          >
            {t('renameCharacter')}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============ FONT OPTIONS ============
const FONT_OPTIONS = {
  'courier-prime': { family: "'Courier Prime', 'Courier New', monospace", label: 'Courier Prime' },
  'courier-new': { family: "'Courier New', Courier, monospace", label: 'Courier New' },
  'courier': { family: "Courier, 'Courier New', monospace", label: 'Courier' },
};
const getFontFamily = (key) => FONT_OPTIONS[key]?.family || FONT_OPTIONS['courier-prime'].family;

// ============ ELEMENT STYLES ============
// V272: getElementStyle, getPlaceholder, getNextType, getEmptyEnterType supprimés
// (styling via CSS classes dans App.css, types gérés par SP_NEXT_TYPE/SP_TAB_FWD dans ScreenplayElement)

// ============ REMOTE CURSOR ============
// eslint-disable-next-line no-unused-vars
const RemoteCursor = ({ user }) => (
  <div style={{ position: 'absolute', left: -12, top: 0, display: 'flex', alignItems: 'flex-start', pointerEvents: 'none', zIndex: 10 }}>
    <div style={{ width: 3, height: 20, background: user.color || '#888', borderRadius: 2, flexShrink: 0 }} />
    <div style={{ marginLeft: 2, background: user.color || '#888', color: 'white', fontSize: 10, padding: '2px 6px', borderRadius: 3, whiteSpace: 'nowrap', fontFamily: 'system-ui, sans-serif', fontWeight: 500, lineHeight: '1.2', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>{user.name || 'Anonyme'}</div>
  </div>
);

// ============ RENDER CONTENT WITH HIGHLIGHTS ============
// Renders text with visual highlights for comments and suggestions
// eslint-disable-next-line no-unused-vars
const renderContentWithHighlights = (content, highlights) => {
  if (!content) return '\u200B';
  if (!highlights || highlights.length === 0) return content;
  
  // Sort highlights by startOffset
  const sorted = [...highlights].sort((a, b) => a.startOffset - b.startOffset);
  
  const parts = [];
  let lastEnd = 0;
  
  for (const h of sorted) {
    // Skip invalid highlights
    if (h.startOffset < 0 || h.endOffset > content.length || h.startOffset >= h.endOffset) continue;
    
    // Add text before this highlight
    if (h.startOffset > lastEnd) {
      parts.push(content.slice(lastEnd, h.startOffset));
    }
    
    const highlightedText = content.slice(h.startOffset, h.endOffset);
    
    if (h.type === 'comment') {
      // Yellow background for comments
      parts.push(
        <span 
          key={`comment-${h.id}`}
          data-comment-id={String(h.id || h._id)}
          style={{ 
            backgroundColor: 'rgba(251, 191, 36, 0.4)', 
            borderRadius: 2, 
            cursor: 'pointer' 
          }}
        >
          {highlightedText}
        </span>
      );
    } else if (h.type === 'suggestion') {
      // Strikethrough original + green suggestion text
      // Use stored originalText for reliability after reload
      const originalTextToShow = h.originalText || content.slice(h.startOffset, h.endOffset);
      parts.push(
        <span 
          key={`suggestion-${h.id}`}
          data-suggestion-id={String(h.id || h._id)}
          style={{ cursor: 'pointer' }}
        >
          <span style={{ 
            textDecoration: 'line-through', 
            color: '#dc2626', 
            background: 'rgba(220, 38, 38, 0.1)' 
          }}>
            {originalTextToShow}
          </span>
          <span style={{ 
            color: '#16a34a', 
            background: 'rgba(22, 163, 74, 0.1)', 
            marginLeft: 2 
          }}>
            {h.suggestedText || ''}
          </span>
        </span>
      );
    }
    
    lastEnd = h.endOffset;
  }
  
  // Add remaining text
  if (lastEnd < content.length) {
    parts.push(content.slice(lastEnd));
  }
  
  return parts.length > 0 ? parts : content;
};

// ============ SCREENPLAY EDITOR (Single TipTap V272) ============
const SingleEditor = React.memo(({
  elements,
  onElementsChange,
  canEdit,
  scriptFont,
  darkMode,
  characters,
  locations,
  onSelectCharacter,
  onSelectLocation,
  onTextSelect,
  onHighlightClick,
  onSuggestionClick,
  onEditorFocus,
  remoteCursors,
  computePageInfoFn,
  highlightsByElement,
  t = (k) => k,
}) => {
  const isEditorOriginRef = useRef(false);
  const isApplyingMarksRef = useRef(false);
  const lastElementsRef = useRef(elements);
  const syncTimeoutRef = useRef(null);
  const marksTimeoutRef = useRef(null);
  const [autoState, setAutoState] = useState({ show: false, items: [], idx: 0, type: null, nodePos: null });

  // Create page break extension that wraps ProseMirror plugin
  const PageBreakExtension = useMemo(() => {
    const plugin = createPageBreakPlugin(computePageInfoFn, stripHtml, darkMode);
    return Extension.create({
      name: 'pageBreakHelper',
      addProseMirrorPlugins() { return [plugin]; },
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        paragraph: false,
        listItem: false,
        history: true,
        hardBreak: false,
        heading: false,
        bulletList: false,
        orderedList: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      ScreenplayElement,
      CommentMark,
      SuggestionMark,
      PageBreakExtension,
    ],
    content: buildDocFromElements(elements),
    editable: canEdit,

    editorProps: {
      attributes: {
        spellcheck: 'false',
      },
      // Handle click on comment/suggestion marks
      handleClick: (view, pos, event) => {
        if (!view) return false;
        try {
          const target = event.target;
          const commentEl = target.closest('[data-comment-id]');
          if (commentEl && onHighlightClick) {
            const commentId = commentEl.getAttribute('data-comment-id');
            setTimeout(() => onHighlightClick(commentId), 0);
            return false;
          }
          const suggestionEl = target.closest('[data-suggestion-id]');
          if (suggestionEl && onSuggestionClick) {
            const suggestionId = suggestionEl.getAttribute('data-suggestion-id');
            setTimeout(() => onSuggestionClick(suggestionId), 0);
            return false;
          }
        } catch (_) {}
        return false;
      },
    },

    onUpdate: ({ editor }) => {
      if (!editor || !editor.view) return;
      // Skip state sync when we're just applying highlight marks
      if (isApplyingMarksRef.current) return;
      try {
        isEditorOriginRef.current = true;
        const newElements = extractElementsFromDoc(editor.state.doc);
        // Debounce the elements state update
        if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = setTimeout(() => {
          if (!elementsEqual(newElements, lastElementsRef.current)) {
            lastElementsRef.current = newElements;
            onElementsChange(newElements);
          }
          // Reset flag after state propagation
          requestAnimationFrame(() => { isEditorOriginRef.current = false; });
        }, 100);
      } catch (_) {}
    },

    onSelectionUpdate: ({ editor }) => {
      if (!editor || !editor.view) return;
      try {
        const { $from, from, to } = editor.state.selection;
        const node = $from.parent;
        if (node.type.name !== 'screenplayElement') return;

        // Text selection → comment/suggestion creation
        if (from !== to && onTextSelect) {
          const selectedText = editor.state.doc.textBetween(from, to);
          if (selectedText.trim()) {
            const nodeStart = $from.before();
            const coords = editor.view.coordsAtPos(from);
            // Compute element index by walking the doc
            let elemIdx = 0;
            editor.state.doc.forEach((child, offset, index) => {
              if (offset <= $from.pos && offset + child.nodeSize > $from.pos) {
                elemIdx = index;
              }
            });
            onTextSelect({
              elementId: node.attrs.elementId,
              elementIndex: elemIdx,
              text: selectedText,
              startOffset: from - nodeStart - 1,
              endOffset: to - nodeStart - 1,
              rect: { top: coords.top, left: coords.left, bottom: coords.bottom, right: coords.right },
            });
          }
        }

        // Autocomplete for character names and locations
        const currentType = node.attrs.elementType;
        const text = node.textContent;

        if (currentType === 'character' && text.length > 0) {
          const q = text.toUpperCase();
          const f = (characters || []).filter(c => c.toUpperCase().startsWith(q) && c.toUpperCase() !== q);
          if (f.length > 0) {
            const coords = editor.view.coordsAtPos(from);
            setAutoState({ show: true, items: f, idx: 0, type: 'character', coords });
          } else {
            setAutoState(prev => prev.show ? { ...prev, show: false } : prev);
          }
        } else if (currentType === 'scene' && text.length > 4) {
          const match = text.match(/^(INT\.|EXT\.|INT\/EXT\.?)\s*(.*)$/i);
          if (match && match[2] && match[2].length > 0) {
            const q = match[2].toUpperCase();
            const f = (locations || []).filter(l => l.startsWith(q) && l !== q);
            if (f.length > 0) {
              const coords = editor.view.coordsAtPos(from);
              setAutoState({ show: true, items: f, idx: 0, type: 'location', coords });
            } else {
              setAutoState(prev => prev.show ? { ...prev, show: false } : prev);
            }
          } else {
            setAutoState(prev => prev.show ? { ...prev, show: false } : prev);
          }
        } else {
          setAutoState(prev => prev.show ? { ...prev, show: false } : prev);
        }
      } catch (_) {}
    },

    onFocus: () => {
      if (onEditorFocus) onEditorFocus();
    },

    onBlur: () => {
      // Clear autocomplete on blur
      setAutoState(prev => prev.show ? { ...prev, show: false } : prev);
    },
  });

  // Sync external changes (socket, import, undo) into the editor
  useEffect(() => {
    if (!editor || isEditorOriginRef.current) return;
    // Don't replace content while user is typing
    if (editor.isFocused) {
      // But still check if elements differ significantly (e.g. from socket full-sync)
      const currentEls = extractElementsFromDoc(editor.state.doc);
      if (elementsEqual(currentEls, elements)) return;
      // If lengths differ, it's a structural change from socket — must apply
      if (currentEls.length === elements.length) return; // Same structure, skip during typing
    }
    const currentEls = extractElementsFromDoc(editor.state.doc);
    if (!elementsEqual(currentEls, elements)) {
      // Save cursor
      const savedPos = editor.state.selection.from;
      editor.commands.setContent(buildDocFromElements(elements), false);
      // Restore cursor position
      try {
        const maxPos = editor.state.doc.content.size - 1;
        editor.commands.setTextSelection(Math.min(savedPos, maxPos));
      } catch (_) {}
      lastElementsRef.current = elements;
    }
  }, [elements, editor]);

  // Update editable state
  useEffect(() => {
    if (editor) {
      const shouldBeEditable = !!canEdit;
      if (editor.isEditable !== shouldBeEditable) {
        editor.setEditable(shouldBeEditable);
      }
    }
  }, [editor, canEdit]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      if (marksTimeoutRef.current) clearTimeout(marksTimeoutRef.current);
    };
  }, []);

  // Apply comment/suggestion marks to editor content (creates real <span> elements for clicks + Safari)
  useEffect(() => {
    if (!editor || !highlightsByElement) return;

    if (marksTimeoutRef.current) clearTimeout(marksTimeoutRef.current);

    marksTimeoutRef.current = setTimeout(() => {
      if (!editor || !editor.view || editor.isDestroyed) return;

      try {
        isApplyingMarksRef.current = true;
        const { tr } = editor.state;
        const schema = editor.state.schema;
        const commentMarkType = schema.marks.comment;
        const suggestionMarkType = schema.marks.suggestion;

        if (!commentMarkType && !suggestionMarkType) {
          isApplyingMarksRef.current = false;
          return;
        }

        // First, remove all existing comment/suggestion marks
        editor.state.doc.forEach((node, pos) => {
          if (node.type.name !== 'screenplayElement') return;
          const nodeStart = pos + 1; // +1 to skip into node content
          const nodeEnd = pos + node.nodeSize - 1;
          if (commentMarkType) {
            tr.removeMark(nodeStart, nodeEnd, commentMarkType);
          }
          if (suggestionMarkType) {
            tr.removeMark(nodeStart, nodeEnd, suggestionMarkType);
          }
        });

        // Then apply marks for each element with highlights
        editor.state.doc.forEach((node, pos) => {
          if (node.type.name !== 'screenplayElement') return;
          const elementId = node.attrs.elementId;
          const highlights = highlightsByElement[elementId];
          if (!highlights || highlights.length === 0) return;

          const nodeStart = pos + 1; // +1 to skip into node content
          const textLength = node.textContent.length;

          highlights.forEach(h => {
            const start = Math.max(0, Math.min(h.startOffset, textLength));
            const end = Math.max(start, Math.min(h.endOffset, textLength));
            if (start >= end) return;

            const from = nodeStart + start;
            const to = nodeStart + end;

            if (h.type === 'comment' && commentMarkType) {
              tr.addMark(from, to, commentMarkType.create({ commentId: h.id }));
            } else if (h.type === 'suggestion' && suggestionMarkType) {
              tr.addMark(from, to, suggestionMarkType.create({
                suggestionId: h.id,
                suggestedText: h.suggestedText || ''
              }));
            }
          });
        });

        // Dispatch without adding to undo history
        tr.setMeta('addToHistory', false);
        editor.view.dispatch(tr);
      } catch (err) {
        console.warn('[Marks] Error applying highlight marks:', err.message);
      } finally {
        // Reset flag after DOM updates settle
        requestAnimationFrame(() => {
          isApplyingMarksRef.current = false;
        });
      }
    }, 200);
  }, [editor, highlightsByElement]);

  // Handle autocomplete selection
  const handleAutoSelect = useCallback((item) => {
    if (!editor) return;
    const { $from } = editor.state.selection;
    const node = $from.parent;
    if (node.type.name !== 'screenplayElement') return;
    const nodeStart = $from.before();

    if (autoState.type === 'character') {
      // Replace entire node content with selected character name
      const tr = editor.state.tr;
      if (node.content.size > 0) {
        tr.delete(nodeStart + 1, nodeStart + 1 + node.content.size);
      }
      tr.insertText(item, nodeStart + 1);
      editor.view.dispatch(tr);
      // Then insert a dialogue element after
      setTimeout(() => {
        editor.commands.splitScreenplayElement();
      }, 10);
    } else if (autoState.type === 'location') {
      const text = node.textContent;
      const match = text.match(/^(INT\.|EXT\.|INT\/EXT\.?)\s*/i);
      const prefix = match ? match[1] + ' ' : '';
      const replacement = prefix + item + ' - ';
      const tr = editor.state.tr;
      if (node.content.size > 0) {
        tr.delete(nodeStart + 1, nodeStart + 1 + node.content.size);
      }
      tr.insertText(replacement, nodeStart + 1);
      editor.view.dispatch(tr);
    }
    setAutoState(prev => ({ ...prev, show: false }));
  }, [editor, autoState.type]);

  // Autocomplete keyboard navigation
  useEffect(() => {
    if (!editor || !autoState.show) return;

    const handleKeyDown = (event) => {
      if (!autoState.show || autoState.items.length === 0) return;
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        event.stopPropagation();
        setAutoState(prev => ({ ...prev, idx: (prev.idx + 1) % prev.items.length }));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        event.stopPropagation();
        setAutoState(prev => ({ ...prev, idx: (prev.idx - 1 + prev.items.length) % prev.items.length }));
      } else if (event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        handleAutoSelect(autoState.items[autoState.idx]);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        setAutoState(prev => ({ ...prev, show: false }));
      }
    };

    // Use capture phase to intercept before TipTap
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [editor, autoState, handleAutoSelect]);

  return (
    <div style={{ position: 'relative' }}>
      <EditorContent editor={editor} />

      {/* Character autocomplete dropdown */}
      {autoState.show && autoState.type === 'character' && autoState.coords && (
        <div style={{
          position: 'fixed',
          top: (autoState.coords.bottom || 0) + 4,
          left: (autoState.coords.left || 0),
          background: '#1e1e1e',
          border: '1px solid #555',
          borderRadius: 6,
          maxHeight: 150,
          overflowY: 'auto',
          zIndex: 1000,
          minWidth: 200,
          boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
        }}>
          {autoState.items.map((s, i) => (
            <div
              key={s}
              onClick={() => handleAutoSelect(s)}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                background: i === autoState.idx ? '#3a3a3a' : '#1e1e1e',
                color: '#e0e0e0',
                fontFamily: getFontFamily(scriptFont),
                fontSize: '12pt',
              }}
            >
              {s}
            </div>
          ))}
        </div>
      )}

      {/* Location autocomplete dropdown */}
      {autoState.show && autoState.type === 'location' && autoState.coords && (
        <div style={{
          position: 'fixed',
          top: (autoState.coords.bottom || 0) + 4,
          left: (autoState.coords.left || 0),
          background: '#1e1e1e',
          border: '1px solid #555',
          borderRadius: 6,
          maxHeight: 150,
          overflowY: 'auto',
          zIndex: 1000,
          minWidth: 250,
          boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
        }}>
          {autoState.items.map((s, i) => (
            <div
              key={s}
              onClick={() => handleAutoSelect(s)}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                background: i === autoState.idx ? '#3a3a3a' : '#1e1e1e',
                color: '#e0e0e0',
                fontFamily: getFontFamily(scriptFont),
                fontSize: '12pt',
              }}
            >
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

// V272: SceneLine, emptyHighlights, buildStyleString supprimés (remplacés par SingleEditor)

// ============ BEAT BOARD COMPONENT ============
const BeatBoard = React.memo(({ 
  elements, 
  setElements, 
  darkMode, 
  sceneSynopsis, 
  setSceneSynopsis,
  sceneStatus,
  setSceneStatus,
  beatCards,
  setBeatCards,
  structureBeats,
  setStructureBeats,
  whiteboardElements,
  setWhiteboardElements,
  onPushToUndo,
  isActive = false,
  t = (k) => k 
}) => {
  const [selectedCards, setSelectedCards] = useState(new Set()); // Multi-select support
  const [draggedCard, setDraggedCard] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isOverTimeline, setIsOverTimeline] = useState(false);
  const [canvasZoom, setCanvasZoom] = useState(1);
  const [timelineZoom, setTimelineZoom] = useState(1);
  // timelineMode removed — always 'blocks' now
  const [hoveredBlock, setHoveredBlock] = useState(null); // { id, rect } or null
  const [editModalCard, setEditModalCard] = useState(null); // Card being edited in modal
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false); // For space+drag panning like Excalidraw
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [pendingDrag, setPendingDrag] = useState(null); // For delayed drag start
  const [whiteboardEnabled, setWhiteboardEnabled] = useState(false); // Whiteboard overlay toggle
  const [whiteboardKey, setWhiteboardKey] = useState(0); // Key to force remount Excalidraw with current zoom/pan
  // convertMenuPos removed — unused
  const [selectedExcalidrawId, setSelectedExcalidrawId] = useState(null); // Selected excalidraw element for conversion
  const [timelineDragId, setTimelineDragId] = useState(null); // Card ID being dragged in timeline
  const [timelineDropIndex, setTimelineDropIndex] = useState(null); // Drop position index in timeline (between blocks)
  const [timelineSyncMode, setTimelineSyncMode] = useState('live'); // 'live' = sync with script, 'staging' = isolated changes
  const [hasTimelineChanges, setHasTimelineChanges] = useState(false); // Track if staging has uncommitted changes
  const lastClickRef = useRef({ cardId: null, time: 0 }); // For manual double-click detection
  const dragOriginalPosRef = useRef(null); // Store original position during drag
  const dragFromTimelineRef = useRef(false); // Track if drag started from timeline
  const dragSelectedPositionsRef = useRef(null); // Store all selected cards positions for multi-drag
  const excalidrawRef = useRef(null); // Excalidraw API ref
  const canvasRef = useRef(null);
  const timelineRef = useRef(null);
  const timelineScrollRef = useRef(null); // For synchronized horizontal scroll
  
  const defaultCardColor = '#ffffff'; // White default for all cards
  const cardColors = ['#ffffff', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
  
  // Initialize beat cards from scenes
  useEffect(() => {
    const scenes = elements.map((el, idx) => ({ ...el, index: idx })).filter(el => el.type === 'scene');
    
    setBeatCards(prev => {
      const customCards = prev.filter(c => !c.linkedSceneId);
      const sceneCards = scenes.map((scene, sceneIdx) => {
        const existingCard = prev.find(c => c.linkedSceneId === scene.id);
        if (existingCard) {
          return { ...existingCard, title: stripHtml(scene.content) || 'Nouvelle scène', synopsis: sceneSynopsis[scene.id] || existingCard.synopsis || '', status: sceneStatus[scene.id] || existingCard.status, linkedSceneIndex: scene.index };
        }
        return {
          id: 'beat_' + scene.id,
          linkedSceneId: scene.id,
          linkedSceneIndex: scene.index,
          title: stripHtml(scene.content) || 'Nouvelle scène',
          synopsis: sceneSynopsis[scene.id] || '',
          color: defaultCardColor,
          position: { x: 50 + (sceneIdx % 5) * 220, y: 180 + Math.floor(sceneIdx / 5) * 160 },
          timelineIndex: sceneIdx,
          status: sceneStatus[scene.id] || null,
          isNew: false,
        };
      });
      return [...sceneCards, ...customCards];
    });
  }, [elements, sceneSynopsis, sceneStatus, setBeatCards]);

  const timelineCards = useMemo(() => beatCards.filter(c => c.timelineIndex !== null).sort((a, b) => a.timelineIndex - b.timelineIndex), [beatCards]);
  // Canvas shows ALL cards (they all live here, timeline is just a "cut" view)
  const canvasCards = useMemo(() => beatCards, [beatCards]);
  
  // Toggle cut/uncut status
  const toggleCut = (cardId) => {
    onPushToUndo?.(); // Save state before modification
    setBeatCards(prev => {
      const card = prev.find(c => c.id === cardId);
      if (!card) return prev;
      
      if (card.timelineIndex !== null) {
        // Currently CUT -> make UNCUT
        return prev.map(c => c.id === cardId ? { ...c, timelineIndex: null } : c);
      } else {
        // Currently UNCUT -> make CUT (add to end of timeline)
        const maxIndex = Math.max(-1, ...prev.filter(c => c.timelineIndex !== null).map(c => c.timelineIndex));
        return prev.map(c => c.id === cardId ? { ...c, timelineIndex: maxIndex + 1 } : c);
      }
    });
  };
  
  // Calculate scene durations (estimated pages and time)
  const sceneMetrics = useMemo(() => {
    const metrics = [];
    let cumulativePages = 0;
    
    timelineCards.forEach(card => {
      if (!card.linkedSceneId) {
        // Custom card - estimate 0.5 page
        metrics.push({ ...card, pages: 0.5, startPage: cumulativePages, startTime: cumulativePages * 60 });
        cumulativePages += 0.5;
        return;
      }
      
      // Find scene elements count to estimate length
      const sceneIdx = card.linkedSceneIndex;
      let nextSceneIdx = elements.findIndex((el, i) => i > sceneIdx && el.type === 'scene');
      if (nextSceneIdx === -1) nextSceneIdx = elements.length;
      
      const sceneElements = elements.slice(sceneIdx, nextSceneIdx);
      // Rough estimate: ~8 elements per page average
      const estimatedPages = Math.max(0.5, Math.round((sceneElements.length / 8) * 2) / 2);
      
      metrics.push({
        ...card,
        pages: estimatedPages,
        startPage: cumulativePages,
        startTime: cumulativePages * 60 // 1 page = 1 minute = 60 seconds
      });
      cumulativePages += estimatedPages;
    });
    
    return { cards: metrics, totalPages: cumulativePages, totalTime: cumulativePages * 60 };
  }, [timelineCards, elements]);
  
  const handleDragStart = (e, card, fromTimeline = false) => {
    e.stopPropagation();
    e.preventDefault(); // Prevent text selection
    const rect = e.currentTarget.getBoundingClientRect();
    
    // Multi-select with Shift key
    if (e.shiftKey) {
      setSelectedCards(prev => {
        const newSet = new Set(prev);
        if (newSet.has(card.id)) {
          newSet.delete(card.id);
        } else {
          newSet.add(card.id);
        }
        return newSet;
      });
      return; // Don't start drag on shift-click
    }
    
    // Determine which cards will be dragged
    // If clicking on unselected card, only drag this one
    // If clicking on selected card, drag all selected cards
    const willDragCards = selectedCards.has(card.id) 
      ? beatCards.filter(c => selectedCards.has(c.id))
      : [card];
    
    // If clicking on unselected card, select only this one
    if (!selectedCards.has(card.id)) {
      setSelectedCards(new Set([card.id]));
    }
    
    // Store pending drag info - actual drag starts on mouse move
    setPendingDrag({
      card,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      time: Date.now(),
      originalPosition: { ...card.position }, // Store original position to restore after timeline drop
      fromTimeline, // Track if dragging from timeline
      // Store only the cards that will actually be dragged
      selectedPositions: new Map(willDragCards.map(c => [c.id, { ...c.position }]))
    });
  };
  
  // Throttle ref for drag move
  const dragMoveRAF = useRef(null);
  
  const handleDragMove = useCallback((e) => {
    // Check if we should start dragging (mouse moved enough from start)
    if (pendingDrag && !draggedCard) {
      const dx = Math.abs(e.clientX - pendingDrag.startX);
      const dy = Math.abs(e.clientY - pendingDrag.startY);
      if (dx > 5 || dy > 5) {
        // Start actual drag - store original position and fromTimeline
        dragOriginalPosRef.current = pendingDrag.originalPosition;
        dragFromTimelineRef.current = pendingDrag.fromTimeline;
        dragSelectedPositionsRef.current = pendingDrag.selectedPositions;
        setDraggedCard(pendingDrag.card);
        setDragOffset({ x: pendingDrag.offsetX, y: pendingDrag.offsetY });
        setPendingDrag(null);
        // Reset double-click detection since we're dragging
        lastClickRef.current = { cardId: null, time: 0 };
      }
      return;
    }
    
    if (!draggedCard || !canvasRef.current) return;
    
    // Throttle position updates with RAF for smooth 60fps
    if (dragMoveRAF.current) return;
    
    dragMoveRAF.current = requestAnimationFrame(() => {
      dragMoveRAF.current = null;
      
      const canvasRect = canvasRef.current?.getBoundingClientRect();
      if (!canvasRect) return;
      
      const timelineRect = timelineRef.current?.getBoundingClientRect();
    
      // Only highlight timeline when cursor is actually over the timeline zone
      const isOverTimelineZone = timelineRect && 
        e.clientY >= timelineRect.top && 
        e.clientY <= timelineRect.bottom;
      setIsOverTimeline(isOverTimelineZone);
      
      // Only update position if dragging from canvas (not from timeline)
      if (!dragFromTimelineRef.current) {
        // New coordinate system: screenPos = (cardPos + scroll) * zoom
        // Inverse: cardPos = (screenPos / zoom) - scroll
        const screenX = e.clientX - canvasRect.left - dragOffset.x;
        const screenY = e.clientY - canvasRect.top - dragOffset.y;
        const newX = (screenX / canvasZoom) - pan.x;
        const newY = (screenY / canvasZoom) - pan.y;
        
        // Calculate delta from original position
        const originalPos = dragOriginalPosRef.current;
        const deltaX = newX - originalPos.x;
        const deltaY = newY - originalPos.y;
        
        // Move all selected cards together
        const selectedPositions = dragSelectedPositionsRef.current;
        setBeatCards(prev => prev.map(c => {
          if (selectedPositions && selectedPositions.has(c.id)) {
            const origPos = selectedPositions.get(c.id);
            return { ...c, position: { x: origPos.x + deltaX, y: origPos.y + deltaY } };
          }
          return c;
        }));
      }
    });
  }, [draggedCard, dragOffset, pan, canvasZoom, pendingDrag, setBeatCards]);

  const handleDragEnd = useCallback((e) => {
    // Cancel any pending RAF
    if (dragMoveRAF.current) {
      cancelAnimationFrame(dragMoveRAF.current);
      dragMoveRAF.current = null;
    }
    
    // Handle click/double-click when no actual drag happened
    if (pendingDrag) {
      const card = pendingDrag.card;
      const now = Date.now();
      const lastClick = lastClickRef.current;
      
      // Check for double-click (same card, within 400ms)
      if (lastClick.cardId === card.id && now - lastClick.time < 400) {
        // Double-click detected - open modal
        setEditModalCard(card);
        lastClickRef.current = { cardId: null, time: 0 };
      } else {
        // Single click - store for potential double-click
        lastClickRef.current = { cardId: card.id, time: now };
      }
      
      setPendingDrag(null);
      return;
    }
    
    if (!draggedCard || !canvasRef.current) return;
    const timelineRect = timelineRef.current?.getBoundingClientRect();
    
    // Check if dropped specifically on the timeline zone
    const isDroppedOnTimeline = timelineRect && 
      e.clientY >= timelineRect.top && 
      e.clientY <= timelineRect.bottom;
    
    const fromTimeline = dragFromTimelineRef.current;
    const originalPos = dragOriginalPosRef.current;
    
    if (isDroppedOnTimeline) {
      // Save state before modification for undo
      onPushToUndo?.();
      
      // Add to timeline (or reorder if already in timeline)
      const x = e.clientX - timelineRect.left;
      const newIndex = Math.max(0, Math.floor((x - 60) / 200));
      
      setBeatCards(prev => {
        // Always restore original position when dropping on timeline
        let cards = prev.map(c => c.id === draggedCard.id ? { ...c, timelineIndex: -999, position: originalPos || c.position } : c);
        const inTimeline = cards.filter(c => c.timelineIndex !== null && c.timelineIndex !== -999).sort((a, b) => a.timelineIndex - b.timelineIndex);
        inTimeline.splice(Math.min(newIndex, inTimeline.length), 0, cards.find(c => c.id === draggedCard.id));
        return cards.map(c => {
          const tlIdx = inTimeline.findIndex(tc => tc.id === c.id);
          return tlIdx >= 0 ? { ...c, timelineIndex: tlIdx } : c;
        });
      });
    } else if (fromTimeline) {
      // Save state before modification for undo
      onPushToUndo?.();
      
      // Dragged FROM timeline and dropped OUTSIDE -> UNCUT (remove from timeline)
      // Keep original position (don't change canvas position)
      setBeatCards(prev => prev.map(c => c.id === draggedCard.id ? { ...c, timelineIndex: null, position: originalPos || c.position } : c));
    }
    // If dragged from canvas and dropped on canvas, position was already updated during drag
    
    setDraggedCard(null);
    setIsOverTimeline(false);
    dragOriginalPosRef.current = null;
    dragFromTimelineRef.current = false;
    dragSelectedPositionsRef.current = null;
  }, [draggedCard, pendingDrag, onPushToUndo, setBeatCards]);

  useEffect(() => {
    if (draggedCard || pendingDrag) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      return () => { window.removeEventListener('mousemove', handleDragMove); window.removeEventListener('mouseup', handleDragEnd); };
    }
  }, [draggedCard, pendingDrag, handleDragMove, handleDragEnd]);
  
  // Navigation handlers - Excalidraw style
  // Pan with Space + drag
  const handlePanStart = useCallback((e) => { 
    if (isSpacePressed && (e.target === canvasRef.current || e.target.classList.contains('beat-canvas-bg'))) { 
      e.preventDefault();
      setIsPanning(true); 
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y }); 
    } 
  }, [isSpacePressed, pan]);
  
  const handlePanMove = useCallback((e) => { 
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y }); 
    }
  }, [isPanning, panStart]);
  
  const handlePanEnd = useCallback(() => setIsPanning(false), []);
  
  // Wheel/pinch handler - must use addEventListener with passive:false to prevent browser zoom
  useEffect(() => {
    if (!isActive || whiteboardEnabled) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    let lastWheelTime = 0;
    
    const handleWheel = (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Throttle to max 60fps
      const now = Date.now();
      if (now - lastWheelTime < 16) return;
      lastWheelTime = now;
      
      // Pinch zoom detection: ctrlKey is set by trackpad pinch, or small deltaY without deltaX
      const isPinch = e.ctrlKey || (Math.abs(e.deltaY) < 50 && Math.abs(e.deltaX) < 10);
      
      if (isPinch) {
        // Zoom - Excalidraw style with smooth factor
        const zoomFactor = 1 - e.deltaY * 0.01;
        setCanvasZoom(z => Math.min(3, Math.max(0.2, z * zoomFactor)));
      } else {
        // Pan - direct 1:1 movement like Excalidraw (no zoom division)
        setPan(p => ({ 
          x: p.x - e.deltaX, 
          y: p.y - e.deltaY 
        }));
      }
    };
    
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [isActive, whiteboardEnabled]);
  
  // Space key listener for pan mode - only when BeatBoard is active
  useEffect(() => {
    if (!isActive) {
      // Reset state when leaving BeatBoard
      setIsSpacePressed(false);
      setIsPanning(false);
      return;
    }
    
    const handleKeyDown = (e) => {
      if (e.code === 'Space' && !e.repeat && 
          !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName) &&
          !document.activeElement?.isContentEditable) {
        e.preventDefault();
        setIsSpacePressed(true);
      }
    };
    const handleKeyUp = (e) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
        setIsPanning(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isActive]);
  
  const addNewCard = () => {
    // Position in visible area: screenPos = (cardPos + scroll) * zoom
    // So cardPos = screenPos / zoom - scroll
    // Place at screen position (100, 200)
    const newCard = { id: 'card_' + Date.now(), linkedSceneId: null, linkedSceneIndex: null, title: 'Nouvelle scène', synopsis: '', color: defaultCardColor, position: { x: 100 / canvasZoom - pan.x, y: 200 / canvasZoom - pan.y }, timelineIndex: null, status: null, isNew: true, type: 'scene' };
    setBeatCards(prev => [...prev, newCard]);
    setSelectedCards(new Set([newCard.id]));
    setEditModalCard(newCard);
  };
  
  // Convert an Excalidraw element to a Beat Board card
  const convertExcalidrawToCard = (elementId, cardType = 'scene') => {
    const api = excalidrawRef.current;
    if (!api) return;
    
    const elements = api.getSceneElements();
    const element = elements.find(el => el.id === elementId);
    if (!element) return;
    
    // Get text content if it's a text element or has bound text
    let title = cardType === 'note' ? '📝 Note' : 'Nouvelle scène';
    let synopsis = '';
    
    if (element.type === 'text') {
      title = element.text.split('\n')[0].substring(0, 50) || title;
      synopsis = element.text.split('\n').slice(1).join('\n') || '';
    } else {
      // Check for bound text elements
      const boundText = elements.find(el => el.containerId === element.id && el.type === 'text');
      if (boundText) {
        title = boundText.text.split('\n')[0].substring(0, 50) || title;
        synopsis = boundText.text.split('\n').slice(1).join('\n') || '';
      }
    }
    
    // Create card at the element's position (Excalidraw coordinates = card coordinates now)
    const newCard = {
      id: (cardType === 'note' ? 'note_' : 'card_') + Date.now(),
      linkedSceneId: null,
      linkedSceneIndex: null,
      title,
      synopsis,
      color: cardType === 'note' ? '#fbbf24' : defaultCardColor,
      position: { 
        x: element.x, 
        y: element.y 
      },
      timelineIndex: null,
      status: null,
      isNew: true,
      type: cardType
    };
    
    setBeatCards(prev => [...prev, newCard]);
    setSelectedCards(new Set([newCard.id]));
    setEditModalCard(newCard);
    
    // Remove the converted element from Excalidraw
    api.updateScene({
      elements: elements.filter(el => el.id !== elementId && el.containerId !== elementId)
    });
    
    // convertMenuPos removed
    setSelectedExcalidrawId(null);
  };
  
  // Handle Excalidraw element selection for conversion AND sync zoom/pan
  const handleExcalidrawChange = (elements, appState) => {
    setWhiteboardElements(elements);
    
    // Sync zoom and pan from Excalidraw to cards canvas
    if (appState.zoom?.value !== undefined) {
      const newZoom = appState.zoom.value;
      if (Math.abs(newZoom - canvasZoom) > 0.01) {
        setCanvasZoom(newZoom);
      }
    }
    if (appState.scrollX !== undefined && appState.scrollY !== undefined) {
      const newPanX = appState.scrollX;
      const newPanY = appState.scrollY;
      if (Math.abs(newPanX - pan.x) > 1 || Math.abs(newPanY - pan.y) > 1) {
        setPan({ x: newPanX, y: newPanY });
      }
    }
    
    // Check if a single element is selected
    const selectedIds = Object.keys(appState.selectedElementIds || {});
    if (selectedIds.length === 1) {
      const selectedElement = elements.find(el => el.id === selectedIds[0]);
      if (selectedElement && (selectedElement.type === 'rectangle' || selectedElement.type === 'ellipse' || selectedElement.type === 'text')) {
        // Show convert menu near the element
        setSelectedExcalidrawId(selectedIds[0]);
      } else {
        setSelectedExcalidrawId(null);
        // convertMenuPos removed
      }
    } else {
      setSelectedExcalidrawId(null);
      // convertMenuPos removed
    }
  };
  
  const deleteCard = (cardId) => {
    const card = beatCards.find(c => c.id === cardId);
    if (card?.linkedSceneId) setBeatCards(prev => prev.map(c => c.id === cardId ? { ...c, timelineIndex: null } : c));
    else setBeatCards(prev => prev.filter(c => c.id !== cardId));
    setSelectedCards(new Set());
  };
  
  const updateCard = (cardId, updates) => {
    setBeatCards(prev => prev.map(c => c.id === cardId ? { ...c, ...updates } : c));
    const card = beatCards.find(c => c.id === cardId);
    if (card?.linkedSceneId && updates.synopsis !== undefined) setSceneSynopsis(prev => ({ ...prev, [card.linkedSceneId]: updates.synopsis }));
  };
  
  const applyTimelineOrder = () => {
    const linkedCards = timelineCards.filter(c => c.linkedSceneId);
    if (linkedCards.length === 0) return;
    
    setElements(prev => {
      const newElements = [];
      const processedScenes = new Set();
      
      linkedCards.forEach(card => {
        const sceneIdx = card.linkedSceneIndex;
        if (processedScenes.has(sceneIdx)) return;
        processedScenes.add(sceneIdx);
        
        // Find scene and all elements until next scene
        let endIdx = prev.findIndex((el, i) => i > sceneIdx && el.type === 'scene');
        if (endIdx === -1) endIdx = prev.length;
        
        for (let i = sceneIdx; i < endIdx; i++) {
          newElements.push(prev[i]);
        }
      });
      
      // Add any remaining scenes not in timeline
      prev.forEach((el, idx) => {
        if (el.type === 'scene' && !processedScenes.has(idx)) {
          let endIdx = prev.findIndex((e, i) => i > idx && e.type === 'scene');
          if (endIdx === -1) endIdx = prev.length;
          for (let i = idx; i < endIdx; i++) {
            if (!newElements.includes(prev[i])) newElements.push(prev[i]);
          }
        }
      });
      
      return newElements.length > 0 ? newElements : prev;
    });
  };
  
  const BeatCard = ({ card, inTimeline = false, excalidrawMode = false, zoom = 1, scroll = { x: 0, y: 0 } }) => {
    const isSelected = selectedCards.has(card.id);
    const isDragging = draggedCard?.id === card.id;
    const isCut = card.timelineIndex !== null;
    const isNote = card.type === 'note';
    const isWhiteCard = card.color === '#ffffff';
    
    // Calculate position to match Excalidraw coordinate system
    // Excalidraw renders elements at: screenPos = (elementPos + scroll) * zoom
    const cardWidth = inTimeline ? 160 : 200;
    const cardMinHeight = inTimeline ? 70 : 120;
    
    // Transform card position to screen position (matching Excalidraw)
    const screenX = inTimeline ? 'auto' : (card.position.x + scroll.x) * zoom;
    const screenY = inTimeline ? 'auto' : (card.position.y + scroll.y) * zoom;
    const scaledWidth = inTimeline ? cardWidth : cardWidth * zoom;
    const scaledMinHeight = inTimeline ? cardMinHeight : cardMinHeight * zoom;
    const scaledFontTitle = inTimeline ? 11 : 11 * zoom;
    const scaledFontSynopsis = inTimeline ? 10 : 10 * zoom;
    const scaledPadding = inTimeline ? '6px 8px' : `${10 * zoom}px ${12 * zoom}px`;
    
    // Post-it style for notes (solid background color)
    const noteColors = {
      '#3b82f6': { bg: '#dbeafe', darkBg: '#1e3a5f', text: '#1e40af', darkText: '#93c5fd' },
      '#22c55e': { bg: '#dcfce7', darkBg: '#14532d', text: '#166534', darkText: '#86efac' },
      '#ef4444': { bg: '#fee2e2', darkBg: '#7f1d1d', text: '#991b1b', darkText: '#fca5a5' },
      '#f97316': { bg: '#ffedd5', darkBg: '#7c2d12', text: '#9a3412', darkText: '#fdba74' },
      '#8b5cf6': { bg: '#ede9fe', darkBg: '#4c1d95', text: '#5b21b6', darkText: '#c4b5fd' },
      '#ec4899': { bg: '#fce7f3', darkBg: '#831843', text: '#9d174d', darkText: '#f9a8d4' },
      '#06b6d4': { bg: '#cffafe', darkBg: '#164e63', text: '#0e7490', darkText: '#67e8f9' },
      '#fbbf24': { bg: '#fef3c7', darkBg: '#78350f', text: '#92400e', darkText: '#fcd34d' },
    };
    const noteStyle = isNote ? (noteColors[card.color] || { bg: '#fef3c7', darkBg: '#78350f', text: '#92400e', darkText: '#fcd34d' }) : null;
    
    // Color bar or left border for white cards
    const leftBorderWidth = inTimeline ? 4 : 4 * zoom;
    
    return (
      <div
        onMouseDown={(e) => handleDragStart(e, card, inTimeline)}
        style={{
          position: inTimeline ? 'relative' : 'absolute',
          left: screenX,
          top: screenY,
          width: scaledWidth,
          minHeight: scaledMinHeight,
          pointerEvents: 'auto', // Always clickable, even when parent has pointerEvents: none
          background: isNote 
            ? (darkMode ? noteStyle?.darkBg : noteStyle?.bg) || '#fef3c7'
            : (darkMode ? '#3a3a3a' : 'white'),
          borderRadius: isNote ? 4 * zoom : 8 * zoom,
          borderLeft: !isNote && isWhiteCard ? `${leftBorderWidth}px solid ${darkMode ? '#6b7280' : '#d1d5db'}` : 'none',
          boxShadow: isSelected 
            ? `0 0 0 ${2 * zoom}px ${isWhiteCard ? '#3b82f6' : card.color}, 0 ${8 * zoom}px ${24 * zoom}px rgba(0,0,0,0.2)` 
            : (isNote ? `${2 * zoom}px ${2 * zoom}px ${8 * zoom}px rgba(0,0,0,0.15)` : `0 ${2 * zoom}px ${8 * zoom}px rgba(0,0,0,0.15)`),
          cursor: isDragging ? 'grabbing' : 'grab',
          opacity: isDragging ? 0.8 : (!inTimeline && !isCut && !isNote ? 0.7 : 1),
          transform: isDragging ? 'scale(1.02) rotate(2deg)' : (isNote && !inTimeline ? 'rotate(-1deg)' : 'scale(1)'),
          transition: isDragging ? 'none' : 'transform 0.15s, box-shadow 0.15s, opacity 0.15s',
          overflow: 'hidden',
          zIndex: isDragging ? 1000 : (isSelected ? 10 : 1),
          flexShrink: 0,
          userSelect: 'none',
          border: !inTimeline && !isCut && !isNote ? `${2 * zoom}px dashed ${darkMode ? '#555' : '#ccc'}` : 'none',
        }}
      >
        {/* Color bar only for scenes with a color (not white, not notes) */}
        {!isNote && !isWhiteCard && <div style={{ height: inTimeline ? 4 : 6 * zoom, background: card.color, borderRadius: `${8 * zoom}px ${8 * zoom}px 0 0` }} />}
        <div style={{ padding: scaledPadding, display: 'flex', flexDirection: 'column', height: inTimeline ? 'auto' : (isWhiteCard ? '100%' : `calc(100% - ${6 * zoom}px)`) }}>
          {/* Title */}
          <div style={{ 
            fontSize: scaledFontTitle, 
            fontWeight: 600, 
            color: isNote ? (darkMode ? noteStyle?.darkText : noteStyle?.text) || '#92400e' : (darkMode ? 'white' : '#1a1a1a'), 
            marginBottom: 4 * zoom, 
            lineHeight: 1.3, 
            overflow: 'hidden', 
            textOverflow: 'ellipsis', 
            display: '-webkit-box', 
            WebkitLineClamp: inTimeline ? 2 : 2, 
            WebkitBoxOrient: 'vertical',
          }}>{card.title}</div>
          
          {/* Synopsis - only on canvas */}
          {!inTimeline && (
            <div style={{ 
              fontSize: scaledFontSynopsis, 
              color: isNote ? (darkMode ? noteStyle?.darkText : noteStyle?.text) || '#92400e' : (darkMode ? '#9ca3af' : '#6b7280'), 
              lineHeight: 1.4, 
              overflow: 'hidden', 
              textOverflow: 'ellipsis', 
              display: '-webkit-box', 
              WebkitLineClamp: 4, 
              WebkitBoxOrient: 'vertical',
              flex: 1,
              marginBottom: 8 * zoom,
            }}>{card.synopsis || (isNote ? 'Double-clic pour éditer' : 'Double-clic pour ajouter un résumé')}</div>
          )}
          
          {/* Footer with controls - only on canvas */}
          {!inTimeline && (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              paddingTop: 6 * zoom, 
              borderTop: `1px solid ${isNote ? (darkMode ? '#ffffff20' : '#00000015') : (darkMode ? '#484848' : '#e5e7eb')}`,
              marginTop: 'auto'
            }}>
              {/* Left: Status badges */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 * zoom }}>
                {card.status && <span style={{ fontSize: 9 * zoom, padding: `${2 * zoom}px ${6 * zoom}px`, borderRadius: 4 * zoom, background: card.status === 'done' ? '#22c55e' : card.status === 'progress' ? '#3b82f6' : '#ef4444', color: 'white' }}>{card.status === 'done' ? '✓' : card.status === 'progress' ? '◐' : '!'}</span>}
                {isNote && <span style={{ fontSize: 9 * zoom }}>📝</span>}
                {card.linkedSceneId && <span style={{ fontSize: 10 * zoom, color: '#6b7280' }}>🔗</span>}
              </div>
              
              {/* Center: CUT/UNCUT badge - not for notes */}
              {!isNote && (
                <button
                  onClick={(e) => { e.stopPropagation(); toggleCut(card.id); }}
                  onMouseDown={(e) => e.stopPropagation()}
                  title={isCut ? 'Dans le montage (clic pour retirer)' : 'Hors montage (clic pour ajouter)'}
                  style={{
                    padding: `${2 * zoom}px ${6 * zoom}px`,
                    fontSize: 8 * zoom,
                    fontWeight: 600,
                    borderRadius: 3 * zoom,
                    border: 'none',
                    cursor: 'pointer',
                    background: isCut ? '#22c55e' : (darkMode ? '#555' : '#e5e7eb'),
                    color: isCut ? 'white' : '#6b7280',
                  }}
                >
                  {isCut ? '🎬 CUT' : 'UNCUT'}
                </button>
              )}
              
              {/* Right: Color picker (only when selected) */}
              {isSelected && (
                <div style={{ display: 'flex', gap: 2 * zoom }}>
                  {cardColors.slice(0, 4).map(color => (
                    <button key={color} onClick={(e) => { e.stopPropagation(); updateCard(card.id, { color }); }} onMouseDown={(e) => e.stopPropagation()} style={{ width: 12 * zoom, height: 12 * zoom, borderRadius: 3 * zoom, background: color, border: card.color === color ? `${2 * zoom}px solid white` : 'none', cursor: 'pointer' }} />
                  ))}
                </div>
              )}
            </div>
          )}
          
          {/* Timeline footer - simplified */}
          {inTimeline && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, paddingTop: 4, borderTop: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}` }}>
              {card.status && <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: card.status === 'done' ? '#22c55e' : card.status === 'progress' ? '#3b82f6' : '#ef4444', color: 'white' }}>{card.status === 'done' ? '✓' : card.status === 'progress' ? '◐' : '!'}</span>}
              {card.linkedSceneId && <span style={{ fontSize: 10, color: '#6b7280' }}>🔗</span>}
            </div>
          )}
        </div>
        {isSelected && !inTimeline && <button onClick={(e) => { e.stopPropagation(); deleteCard(card.id); }} onMouseDown={(e) => e.stopPropagation()} style={{ position: 'absolute', top: isNote ? 4 * zoom : 8 * zoom, right: 8 * zoom, width: 18 * zoom, height: 18 * zoom, borderRadius: '50%', background: '#ef4444', border: 'none', color: 'white', fontSize: 11 * zoom, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>}
      </div>
    );
  };
  
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: darkMode ? '#1a1a1a' : '#f0f0f0', overflow: 'hidden' }}>
      {/* Timeline zone with Structure row - Video editor style */}
      <div ref={timelineRef} style={{ background: isOverTimeline ? (darkMode ? '#2a4a2a' : '#dcfce7') : (darkMode ? '#252525' : '#fafafa'), borderBottom: `2px solid ${isOverTimeline ? '#22c55e' : (darkMode ? '#484848' : '#e5e7eb')}`, display: 'flex', flexDirection: 'column', transition: 'background 0.2s' }}>
        {/* Timeline header - minimal */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px', borderBottom: `1px solid ${darkMode ? '#3a3a3a' : '#e5e7eb'}` }}>
          <span style={{ fontSize: 10, color: '#6b7280', fontWeight: 600 }}>TIMELINE</span>
          
          {/* Mode toggle: Live / Staging */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: darkMode ? '#333' : '#e5e7eb', borderRadius: 4, padding: 2 }}>
            <button
              onClick={() => { setTimelineSyncMode('live'); setHasTimelineChanges(false); }}
              style={{
                padding: '2px 8px',
                fontSize: 9,
                fontWeight: 500,
                background: timelineSyncMode === 'live' ? '#3b82f6' : 'transparent',
                color: timelineSyncMode === 'live' ? 'white' : '#6b7280',
                border: 'none',
                borderRadius: 3,
                cursor: 'pointer'
              }}
              title="Synchronisation automatique avec le script"
            >
              Live
            </button>
            <button
              onClick={() => setTimelineSyncMode('staging')}
              style={{
                padding: '2px 8px',
                fontSize: 9,
                fontWeight: 500,
                background: timelineSyncMode === 'staging' ? '#f59e0b' : 'transparent',
                color: timelineSyncMode === 'staging' ? 'white' : '#6b7280',
                border: 'none',
                borderRadius: 3,
                cursor: 'pointer'
              }}
              title="Mode brouillon - les changements ne sont pas appliqués au script"
            >
              Brouillon
            </button>
          </div>
          
          {/* Commit button - only in staging mode with changes */}
          {timelineSyncMode === 'staging' && hasTimelineChanges && (
            <button
              onClick={() => {
                onPushToUndo?.();
                
                // Get the current timeline order of scene IDs
                const timelineOrder = beatCards
                  .filter(c => c.timelineIndex !== null)
                  .sort((a, b) => a.timelineIndex - b.timelineIndex)
                  .map(c => c.linkedSceneId)
                  .filter(Boolean);
                
                // Reorder elements to match timeline
                const sceneIndices = elements.map((el, i) => el.type === 'scene' ? i : -1).filter(i => i >= 0);
                
                // Build new elements array
                let newElements = [];
                let usedSceneIds = new Set();
                
                timelineOrder.forEach(sceneId => {
                  const sceneIdx = elements.findIndex(el => el.id === sceneId);
                  if (sceneIdx === -1) return;
                  
                  const scenePos = sceneIndices.indexOf(sceneIdx);
                  const nextSceneIdx = scenePos < sceneIndices.length - 1 ? sceneIndices[scenePos + 1] : elements.length;
                  
                  newElements.push(...elements.slice(sceneIdx, nextSceneIdx));
                  usedSceneIds.add(sceneId);
                });
                
                // Add any scenes not in timeline at the end
                elements.filter(el => el.type === 'scene').forEach(scene => {
                  if (!usedSceneIds.has(scene.id)) {
                    const sceneIdx = elements.findIndex(el => el.id === scene.id);
                    const scenePos = sceneIndices.indexOf(sceneIdx);
                    const nextSceneIdx = scenePos < sceneIndices.length - 1 ? sceneIndices[scenePos + 1] : elements.length;
                    newElements.push(...elements.slice(sceneIdx, nextSceneIdx));
                  }
                });
                
                setElements(newElements);
                setHasTimelineChanges(false);
              }}
              style={{
                padding: '3px 10px',
                fontSize: 10,
                fontWeight: 600,
                background: '#22c55e',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                animation: 'pulse 2s infinite'
              }}
              title="Appliquer l'ordre de la timeline au script"
            >
              ✓ Appliquer au script
            </button>
          )}
          
          {timelineSyncMode === 'staging' && !hasTimelineChanges && (
            <span style={{ fontSize: 9, color: '#6b7280', fontStyle: 'italic' }}>
              Réorganisez les blocs puis appliquez
            </span>
          )}
          
          <div style={{ flex: 1 }} />
          
          {/* Zoom slider - calculated based on card count */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/><path d="M8 11h6"/></svg>
            <input
              type="range"
              min="0.15"
              max={Math.max(1.5, Math.min(3, 30 / Math.max(1, timelineCards.length)))}
              step="0.01"
              value={timelineZoom}
              onChange={(e) => setTimelineZoom(parseFloat(e.target.value))}
              style={{ width: 80, height: 3, cursor: 'pointer', accentColor: '#3b82f6' }}
            />
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/><path d="M8 11h6M11 8v6"/></svg>
          </div>
        </div>
        
        {/* Timeline content with fixed labels and scrollable content */}
        <div 
          style={{ display: 'flex', flex: 1 }}
        >
          {/* Fixed labels column */}
          <div style={{ width: 50, flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: `1px solid ${darkMode ? '#3a3a3a' : '#e5e7eb'}` }}>
            <div style={{ height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#6b7280', background: darkMode ? '#1f1f1f' : '#f8f9fa', borderBottom: `1px solid ${darkMode ? '#3a3a3a' : '#e5e7eb'}` }}>STRUCT</div>
            {sceneMetrics.totalPages > 0 && (
              <>
                <div style={{ height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#6b7280', background: darkMode ? '#2a2a2a' : '#f3f4f6', borderBottom: `1px solid ${darkMode ? '#3a3a3a' : '#e5e7eb'}` }}>TIME</div>
                <div style={{ height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#6b7280', background: darkMode ? '#252525' : '#fafafa', borderBottom: `1px solid ${darkMode ? '#3a3a3a' : '#e5e7eb'}` }}>PAGE</div>
              </>
            )}
            <div style={{ flex: 1, minHeight: 40 }} />
          </div>
          
          {/* Scrollable content area - all rows scroll together */}
          <div ref={timelineScrollRef} style={{ flex: 1, overflowX: 'auto', overflowY: 'visible', display: 'flex', flexDirection: 'column' }}>
            {/* Structure row */}
            <div style={{ display: 'flex', height: 28, background: darkMode ? '#1f1f1f' : '#f8f9fa', borderBottom: `1px solid ${darkMode ? '#3a3a3a' : '#e5e7eb'}`, minWidth: 'fit-content', position: 'relative' }}>
              {(() => {
                const totalWidth = Math.max(300, sceneMetrics.totalPages * 60 * timelineZoom);
                
                if (structureBeats.length === 0) {
                  return (
                    <div 
                      style={{ width: totalWidth, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', fontSize: 10, fontStyle: 'italic', cursor: 'pointer' }}
                      onClick={() => {
                        // Create first beat starting at first scene
                        const firstScene = elements.find(el => el.type === 'scene');
                        const label = prompt('Nom du premier bloc (ex: Acte 1)');
                        if (label && firstScene) setStructureBeats([{ id: 'struct_' + Date.now(), label, startSceneId: firstScene.id, color: null }]);
                      }}
                    >
                      Cliquez pour ajouter une structure
                    </div>
                  );
                }
                
                // Sort beats by their scene position
                const sortedBeats = [...structureBeats].sort((a, b) => {
                  const aCard = sceneMetrics.cards.find(c => c.linkedSceneId === a.startSceneId);
                  const bCard = sceneMetrics.cards.find(c => c.linkedSceneId === b.startSceneId);
                  return (aCard?.startPage || 0) - (bCard?.startPage || 0);
                });
                
                return (
                  <div style={{ display: 'flex', width: totalWidth, position: 'relative' }}>
                    {sortedBeats.map((beat, idx) => {
                      // Find the start position of this beat
                      const startCard = sceneMetrics.cards.find(c => c.linkedSceneId === beat.startSceneId);
                      const startPage = startCard?.startPage || 0;
                      
                      // Find the end position (start of next beat or end of timeline)
                      const nextBeat = sortedBeats[idx + 1];
                      let endPage = sceneMetrics.totalPages;
                      if (nextBeat) {
                        const nextCard = sceneMetrics.cards.find(c => c.linkedSceneId === nextBeat.startSceneId);
                        endPage = nextCard?.startPage || sceneMetrics.totalPages;
                      }
                      
                      const left = startPage * 60 * timelineZoom;
                      const width = Math.max(40, (endPage - startPage) * 60 * timelineZoom);
                      
                      return (
                        <div
                          key={beat.id}
                          style={{
                            position: 'absolute',
                            left,
                            width,
                            height: '100%',
                            background: beat.color || (darkMode ? '#2a2a2a' : '#e5e7eb'),
                            borderRight: `1px solid ${darkMode ? '#1a1a1a' : 'white'}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 10,
                            fontWeight: 600,
                            color: beat.color ? 'white' : (darkMode ? '#d1d5db' : '#374151'),
                            cursor: 'pointer',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            padding: '0 4px',
                          }}
                          onClick={() => {
                            const newLabel = prompt('Nouveau nom:', beat.label);
                            if (newLabel !== null) setStructureBeats(prev => prev.map(b => b.id === beat.id ? { ...b, label: newLabel } : b));
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            if (window.confirm(`Supprimer "${beat.label}" ?`)) {
                              setStructureBeats(prev => prev.filter(b => b.id !== beat.id));
                            }
                          }}
                        >
                          {beat.label}
                        </div>
                      );
                    })}
                    {/* Add new beat button at end */}
                    <div
                      style={{
                        position: 'absolute',
                        right: 4,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        fontSize: 14,
                        color: '#6b7280',
                        cursor: 'pointer',
                        zIndex: 5,
                        background: darkMode ? '#2a2a2a' : '#e5e7eb',
                        borderRadius: '50%',
                        width: 18,
                        height: 18,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        // Find a scene that doesn't have a beat yet
                        const scenes = elements.filter(el => el.type === 'scene');
                        const usedSceneIds = new Set(structureBeats.map(b => b.startSceneId));
                        const availableScenes = scenes.filter(s => !usedSceneIds.has(s.id));
                        
                        if (availableScenes.length === 0) {
                          alert('Toutes les scènes ont déjà un bloc de structure');
                          return;
                        }
                        
                        const label = prompt('Nom du nouveau bloc:');
                        if (label) {
                          // Add at middle available scene
                          const midScene = availableScenes[Math.floor(availableScenes.length / 2)];
                          setStructureBeats(prev => [...prev, { id: 'struct_' + Date.now(), label, startSceneId: midScene.id, color: null }]);
                        }
                      }}
                      title="Ajouter un bloc"
                    >
                      +
                    </div>
                  </div>
                );
              })()}
            </div>
            
            {/* Time and Page rulers */}
            {sceneMetrics.totalPages > 0 && (
              <>
                <div style={{ display: 'flex', height: 16, background: darkMode ? '#2a2a2a' : '#f3f4f6', borderBottom: `1px solid ${darkMode ? '#3a3a3a' : '#e5e7eb'}`, fontSize: 9, color: '#6b7280' }}>
                  {Array.from({ length: Math.ceil(sceneMetrics.totalTime / 60) + 1 }, (_, i) => (
                    <div key={i} style={{ width: 60 * timelineZoom, flexShrink: 0, borderRight: `1px solid ${darkMode ? '#3a3a3a' : '#d1d5db'}`, paddingLeft: 4, display: 'flex', alignItems: 'center' }}>
                      {String(Math.floor(i / 60)).padStart(2, '0')}:{String(i % 60).padStart(2, '0')}:00
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', height: 14, background: darkMode ? '#252525' : '#fafafa', borderBottom: `1px solid ${darkMode ? '#3a3a3a' : '#e5e7eb'}`, fontSize: 9, color: '#6b7280' }}>
                  {Array.from({ length: Math.ceil(sceneMetrics.totalPages) + 1 }, (_, i) => (
                    <div key={i} style={{ width: 60 * timelineZoom, flexShrink: 0, borderRight: `1px solid ${darkMode ? '#3a3a3a' : '#e5e7eb'}`, paddingLeft: 4, display: 'flex', alignItems: 'center' }}>
                      p.{i + 1}
                    </div>
                  ))}
                </div>
              </>
            )}
            
            {/* Blocks row */}
            <div 
              style={{ display: 'flex', height: 40, position: 'relative', minWidth: 'fit-content', overflow: 'visible' }}
              onMouseMove={(e) => {
                if (!timelineDragId) return;
                // Find which block we're over
                const blocks = e.currentTarget.querySelectorAll('[data-timeline-block]');
                let foundDropIndex = null;
                blocks.forEach((block, idx) => {
                  const rect = block.getBoundingClientRect();
                  if (e.clientX >= rect.left && e.clientX <= rect.right) {
                    const midX = rect.left + rect.width / 2;
                    foundDropIndex = e.clientX < midX ? idx : idx + 1;
                  }
                });
                // If past the last block
                if (foundDropIndex === null && blocks.length > 0) {
                  const lastRect = blocks[blocks.length - 1].getBoundingClientRect();
                  if (e.clientX > lastRect.right) {
                    foundDropIndex = blocks.length;
                  } else if (e.clientX < blocks[0].getBoundingClientRect().left) {
                    foundDropIndex = 0;
                  }
                }
                if (foundDropIndex !== null && foundDropIndex !== timelineDropIndex) {
                  setTimelineDropIndex(foundDropIndex);
                }
              }}
              onMouseUp={() => {
                if (timelineDragId && timelineDropIndex !== null) {
                  // Reorder cards in timeline
                  const draggedIdx = sceneMetrics.cards.findIndex(c => c.id === timelineDragId);
                  if (draggedIdx !== -1 && draggedIdx !== timelineDropIndex && draggedIdx !== timelineDropIndex - 1) {
                    // Save state before modification for undo
                    onPushToUndo?.();
                    
                    const orderedIds = sceneMetrics.cards.map(c => c.id);
                    const [draggedId] = orderedIds.splice(draggedIdx, 1);
                    const insertIdx = timelineDropIndex > draggedIdx ? timelineDropIndex - 1 : timelineDropIndex;
                    orderedIds.splice(insertIdx, 0, draggedId);
                    
                    setBeatCards(prev => prev.map(c => {
                      const newIdx = orderedIds.indexOf(c.id);
                      if (newIdx !== -1) {
                        return { ...c, timelineIndex: newIdx };
                      }
                      return c;
                    }));
                    
                    // In live mode, also reorder the script
                    if (timelineSyncMode === 'live') {
                      // Get the new order of scene IDs from timeline
                      const newSceneOrder = orderedIds
                        .map(id => beatCards.find(c => c.id === id)?.linkedSceneId)
                        .filter(Boolean);
                      
                      // Reorder elements to match timeline
                      const sceneElements = elements.filter(el => el.type === 'scene');
                      const sceneIndices = elements.map((el, i) => el.type === 'scene' ? i : -1).filter(i => i >= 0);
                      
                      // Build new elements array
                      let newElements = [];
                      let usedSceneIds = new Set();
                      
                      newSceneOrder.forEach(sceneId => {
                        const sceneEl = elements.find(el => el.id === sceneId);
                        if (!sceneEl) return;
                        
                        const sceneIdx = elements.findIndex(el => el.id === sceneId);
                        const scenePos = sceneIndices.indexOf(sceneIdx);
                        const nextSceneIdx = scenePos < sceneIndices.length - 1 ? sceneIndices[scenePos + 1] : elements.length;
                        
                        // Add this scene and all its elements
                        newElements.push(...elements.slice(sceneIdx, nextSceneIdx));
                        usedSceneIds.add(sceneId);
                      });
                      
                      // Add any scenes not in timeline at the end
                      sceneElements.forEach(scene => {
                        if (!usedSceneIds.has(scene.id)) {
                          const sceneIdx = elements.findIndex(el => el.id === scene.id);
                          const scenePos = sceneIndices.indexOf(sceneIdx);
                          const nextSceneIdx = scenePos < sceneIndices.length - 1 ? sceneIndices[scenePos + 1] : elements.length;
                          newElements.push(...elements.slice(sceneIdx, nextSceneIdx));
                        }
                      });
                      
                      setElements(newElements);
                    } else {
                      // Staging mode - mark as having changes
                      setHasTimelineChanges(true);
                    }
                  }
                }
                setTimelineDragId(null);
                setTimelineDropIndex(null);
              }}
              onMouseLeave={() => {
                if (timelineDragId) {
                  setTimelineDragId(null);
                  setTimelineDropIndex(null);
                }
              }}
            >
              {timelineCards.length === 0 ? (
                <div style={{ flex: 1, minWidth: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', fontSize: 11, border: `2px dashed ${darkMode ? '#484848' : '#d1d5db'}`, borderRadius: 6, margin: 4 }}>
                  Glissez des cartes ici pour construire votre timeline
                </div>
              ) : (
                sceneMetrics.cards.map((card, idx) => {
                  const blockWidth = Math.max(20, card.pages * 60 * timelineZoom);
                  const fullCard = beatCards.find(c => c.id === card.id);
                  const isWhite = card.color === '#ffffff';
                  const blockBg = isWhite ? (darkMode ? '#555' : '#e5e7eb') : card.color;
                  const textColor = isWhite ? (darkMode ? 'white' : '#374151') : 'white';
                  const isDragging = timelineDragId === card.id;
                  const draggedIdx = timelineDragId ? sceneMetrics.cards.findIndex(c => c.id === timelineDragId) : -1;
                  const showDropBefore = timelineDropIndex === idx && timelineDragId && draggedIdx !== idx && draggedIdx !== idx - 1;
                  const showDropAfter = timelineDropIndex === idx + 1 && timelineDragId && draggedIdx !== idx && draggedIdx !== idx + 1;
                  
                  return (
                    <React.Fragment key={card.id}>
                      {/* Drop indicator - before this block */}
                      {showDropBefore && (
                        <div style={{
                          width: 4,
                          height: '100%',
                          background: '#3b82f6',
                          borderRadius: 2,
                          boxShadow: '0 0 8px #3b82f6, 0 0 16px #3b82f6',
                          flexShrink: 0,
                          zIndex: 20
                        }} />
                      )}
                      <div
                        data-timeline-block={card.id}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setTimelineDragId(card.id);
                          setTimelineDropIndex(null);
                        }}
                        onMouseEnter={(e) => {
                          if (!timelineDragId) {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setHoveredBlock({ id: card.id, rect, card: { ...card, synopsis: fullCard?.synopsis || card.synopsis } });
                          }
                        }}
                        onMouseLeave={() => {
                          if (!timelineDragId) setHoveredBlock(null);
                        }}
                        onDoubleClick={() => setEditModalCard(fullCard || card)}
                        style={{
                          width: blockWidth,
                          height: '100%',
                          background: isDragging ? '#3b82f6' : blockBg,
                          borderRight: `1px solid ${darkMode ? '#1a1a1a' : 'white'}`,
                          cursor: timelineDragId ? 'grabbing' : 'grab',
                          position: 'relative',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'visible',
                          opacity: isDragging ? 0.6 : (selectedCards.has(card.id) ? 1 : 0.85),
                          boxShadow: isDragging 
                            ? '0 0 12px rgba(59, 130, 246, 0.8)' 
                            : (selectedCards.has(card.id) ? `inset 0 0 0 2px ${isWhite ? '#3b82f6' : 'white'}` : 'none'),
                          flexShrink: 0,
                          transition: 'opacity 0.15s, box-shadow 0.15s',
                          transform: isDragging ? 'scale(1.05)' : 'scale(1)',
                        }}
                      >
                        {blockWidth > 60 && (
                          <span style={{ fontSize: 9, color: isDragging ? 'white' : textColor, textShadow: isWhite && !isDragging ? 'none' : '0 1px 2px rgba(0,0,0,0.5)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0 4px', maxWidth: '100%' }}>
                            {card.title.replace(/^(INT\.|EXT\.|INT\/EXT\.)\s*/i, '').substring(0, 20)}
                          </span>
                        )}
                      </div>
                      {/* Drop indicator - after this block */}
                      {showDropAfter && (
                        <div style={{
                          width: 4,
                          height: '100%',
                          background: '#3b82f6',
                          borderRadius: 2,
                          boxShadow: '0 0 8px #3b82f6, 0 0 16px #3b82f6',
                          flexShrink: 0,
                          zIndex: 20,
                          marginLeft: -2
                        }} />
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </div>
          </div>
          
          {/* Add structure button */}
          <button
            onClick={() => {
              const label = prompt('Nom du nouveau bloc (ex: Acte 1, Élément déclencheur...)');
              if (label) setStructureBeats(prev => [...prev, { id: 'struct_' + Date.now(), label, flex: 1, color: null }]);
            }}
            style={{ width: 28, flexShrink: 0, background: darkMode ? '#333' : '#e5e7eb', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#6b7280' }}
            title="Ajouter un bloc de structure"
          >
            +
          </button>
        </div>
      </div>
      
      {/* Canvas zone */}
      <div ref={canvasRef} className="beat-canvas-bg" onMouseDown={!whiteboardEnabled ? handlePanStart : undefined} onMouseMove={!whiteboardEnabled ? handlePanMove : undefined} onMouseUp={!whiteboardEnabled ? handlePanEnd : undefined} onMouseLeave={!whiteboardEnabled ? handlePanEnd : undefined} onClick={!whiteboardEnabled ? () => setSelectedCards(new Set()) : undefined} style={{ flex: 1, position: 'relative', overflow: 'hidden', cursor: isPanning ? 'grabbing' : (isSpacePressed ? 'grab' : 'default'), touchAction: 'none', backgroundImage: darkMode ? 'radial-gradient(circle, #484848 1px, transparent 1px)' : 'radial-gradient(circle, #d1d5db 1px, transparent 1px)', backgroundSize: `${20 * canvasZoom}px ${20 * canvasZoom}px`, backgroundPosition: `${pan.x * canvasZoom}px ${pan.y * canvasZoom}px` }}>
        {/* Beat cards layer - ABOVE Excalidraw so cards remain interactive */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: whiteboardEnabled ? 60 : 1, overflow: 'hidden' }}>
          {canvasCards.map(card => (
            <BeatCard 
              key={card.id} 
              card={card} 
              inTimeline={false} 
              excalidrawMode={whiteboardEnabled}
              zoom={canvasZoom}
              scroll={{ x: pan.x, y: pan.y }}
            />
          ))}
        </div>
        
        {/* Excalidraw whiteboard overlay - transparent background to see cards */}
        {whiteboardEnabled && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 50, width: '100%', height: '100%' }}>
            <style>{`
              .excalidraw, .excalidraw.theme--dark, .excalidraw.theme--light {
                --color-surface-primary-container: transparent !important;
                background: transparent !important;
              }
              .excalidraw .App-menu, .excalidraw .layer-ui__wrapper {
                background: transparent !important;
              }
              .excalidraw canvas {
                background: transparent !important;
              }
              /* Hide side elements with visibility to keep layout balanced for centering */
              .excalidraw .layer-ui__wrapper__top-right,
              .excalidraw .layer-ui__wrapper__top-left {
                visibility: hidden !important;
                pointer-events: none !important;
              }
              /* Completely hide footer elements */
              .excalidraw .layer-ui__wrapper__footer-right,
              .excalidraw .layer-ui__wrapper__footer-left,
              .excalidraw .layer-ui__wrapper__footer-center {
                display: none !important;
              }
            `}</style>
            <Suspense fallback={
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#6b7280' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>✏️</div>
                  <div>Chargement du whiteboard...</div>
                </div>
              </div>
            }>
              <Excalidraw
                key={whiteboardKey}
                excalidrawAPI={(api) => { excalidrawRef.current = api; }}
                initialData={{ 
                  elements: whiteboardElements,
                  appState: { 
                    viewBackgroundColor: 'transparent',
                    theme: darkMode ? 'dark' : 'light',
                    gridSize: null,
                    zenModeEnabled: false,
                    viewModeEnabled: false,
                    scrollX: pan.x,
                    scrollY: pan.y,
                    zoom: { value: canvasZoom },
                  }
                }}
                onChange={handleExcalidrawChange}
                theme={darkMode ? 'dark' : 'light'}
                UIOptions={{
                  canvasActions: {
                    loadScene: false,
                    export: { saveFileToDisk: false },
                    saveAsImage: false,
                    changeViewBackgroundColor: false,
                  },
                  tools: {
                    image: false,
                  }
                }}
              />
            </Suspense>
            
            {/* Convert to card menu - appears when a shape is selected */}
            {selectedExcalidrawId && (
              <div style={{
                position: 'absolute',
                top: 60,
                left: '50%',
                transform: 'translateX(-50%)',
                background: darkMode ? '#2a2a2a' : 'white',
                border: `1px solid ${darkMode ? '#484848' : '#d1d5db'}`,
                borderRadius: 8,
                padding: 8,
                display: 'flex',
                gap: 8,
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                zIndex: 1000,
              }}>
                <span style={{ fontSize: 11, color: '#6b7280', alignSelf: 'center', marginRight: 4 }}>Convertir en :</span>
                <button
                  onClick={() => convertExcalidrawToCard(selectedExcalidrawId, 'scene')}
                  style={{
                    padding: '6px 12px',
                    background: '#3b82f6',
                    border: 'none',
                    borderRadius: 6,
                    color: 'white',
                    fontSize: 11,
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  🎬 Scène
                </button>
                <button
                  onClick={() => convertExcalidrawToCard(selectedExcalidrawId, 'note')}
                  style={{
                    padding: '6px 12px',
                    background: '#fbbf24',
                    border: 'none',
                    borderRadius: 6,
                    color: '#92400e',
                    fontSize: 11,
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  📝 Note
                </button>
              </div>
            )}
            
            {/* Whiteboard instructions */}
            <div style={{
              position: 'absolute',
              bottom: 16,
              left: 16,
              background: darkMode ? 'rgba(51,51,51,0.9)' : 'rgba(255,255,255,0.9)',
              padding: '8px 12px',
              borderRadius: 6,
              fontSize: 10,
              color: '#6b7280',
              maxWidth: 280,
            }}>
              💡 Dessinez librement • Sélectionnez une forme pour la convertir en carte • iPad + Apple Pencil supporté
            </div>
          </div>
        )}
        
        {canvasCards.length === 0 && timelineCards.length > 0 && !whiteboardEnabled && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', color: '#6b7280' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎬</div>
            <div style={{ fontSize: 14, marginBottom: 8 }}>Toutes vos scènes sont dans la timeline</div>
            <div style={{ fontSize: 12 }}>Cliquez sur "+ Carte" pour ajouter des idées</div>
          </div>
        )}
        
        {/* Canvas controls overlay - moves down when whiteboard is enabled to not hide Excalidraw menu */}
        <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', alignItems: 'center', gap: 6, zIndex: 100 }}>
          <button onClick={addNewCard} style={{ padding: '7px 12px', background: '#3b82f6', border: 'none', borderRadius: 6, color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, boxShadow: '0 2px 8px rgba(0,0,0,0.2)', height: 32 }}>
            <span style={{ fontSize: 14 }}>+</span> Carte
          </button>
          <button onClick={() => {
            const newNote = { id: 'note_' + Date.now(), linkedSceneId: null, linkedSceneIndex: null, title: '📝 Note', synopsis: '', color: '#fbbf24', position: { x: 150 / canvasZoom - pan.x, y: 150 / canvasZoom - pan.y }, timelineIndex: null, status: null, isNew: true, type: 'note' };
            setBeatCards(prev => [...prev, newNote]);
            setSelectedCards(new Set([newNote.id]));
            setEditModalCard(newNote);
          }} style={{ padding: '7px 12px', background: darkMode ? 'rgba(85,85,85,0.95)' : 'rgba(254,243,199,0.98)', border: 'none', borderRadius: 6, color: darkMode ? '#fbbf24' : '#92400e', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, boxShadow: '0 2px 8px rgba(0,0,0,0.15)', height: 32 }}>
            📝 Note
          </button>
          <button 
            onClick={() => {
              if (!whiteboardEnabled) setWhiteboardKey(k => k + 1);
              setWhiteboardEnabled(!whiteboardEnabled);
            }}
            style={{ 
              padding: '7px 12px', 
              height: 32,
              background: whiteboardEnabled ? '#8b5cf6' : (darkMode ? 'rgba(58,58,58,0.95)' : 'rgba(255,255,255,0.98)'), 
              border: whiteboardEnabled ? 'none' : `1px solid ${darkMode ? '#555' : '#d1d5db'}`,
              borderRadius: 6, 
              color: whiteboardEnabled ? 'white' : (darkMode ? '#9ca3af' : '#6b7280'), 
              fontSize: 12, 
              fontWeight: 600, 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              gap: 5,
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            }}
            title="Activer le whiteboard pour dessiner"
          >
            ✏️ {whiteboardEnabled ? 'Dessin ON' : 'Dessiner'}
          </button>
        </div>
        
        {/* Stats and apply button - Top right - moves down when whiteboard is enabled */}
        <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', alignItems: 'center', gap: 8, zIndex: 100 }}>
          <div style={{ background: darkMode ? 'rgba(51,51,51,0.9)' : 'rgba(255,255,255,0.95)', padding: '6px 10px', borderRadius: 6, boxShadow: '0 2px 8px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 500 }}>{timelineCards.length} CUT</span>
            <span style={{ fontSize: 10, color: '#9ca3af' }}>{beatCards.filter(c => c.timelineIndex === null).length} UNCUT</span>
            <span style={{ fontSize: 10, color: '#6b7280' }}>•</span>
            <span style={{ fontSize: 10, color: '#6b7280' }}>{sceneMetrics.totalPages.toFixed(1)}p</span>
          </div>
          {timelineCards.filter(c => c.linkedSceneId).length > 0 && (
            <button 
              onClick={applyTimelineOrder}
              style={{ padding: '6px 12px', background: '#22c55e', border: 'none', borderRadius: 6, color: 'white', fontSize: 11, fontWeight: 500, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}
            >
              Appliquer au script
            </button>
          )}
        </div>
        
        {/* Canvas zoom controls - Bottom right overlay - Hidden when whiteboard is active (use Excalidraw's controls) */}
        {!whiteboardEnabled && (
          <div style={{ position: 'absolute', bottom: 16, right: 16, display: 'flex', alignItems: 'center', gap: 4, background: darkMode ? 'rgba(51,51,51,0.9)' : 'rgba(255,255,255,0.9)', padding: '6px 8px', borderRadius: 6, boxShadow: '0 2px 8px rgba(0,0,0,0.15)', zIndex: 10 }}>
            <button onClick={() => setCanvasZoom(z => Math.max(0.3, z - 0.1))} style={{ width: 24, height: 24, borderRadius: 4, background: darkMode ? '#484848' : '#e5e7eb', border: 'none', color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
            <span style={{ fontSize: 11, color: '#6b7280', minWidth: 36, textAlign: 'center' }}>{Math.round(canvasZoom * 100)}%</span>
            <button onClick={() => setCanvasZoom(z => Math.min(2, z + 0.1))} style={{ width: 24, height: 24, borderRadius: 4, background: darkMode ? '#484848' : '#e5e7eb', border: 'none', color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
            <button onClick={() => { setCanvasZoom(1); setPan({ x: 0, y: 0 }); }} style={{ marginLeft: 4, padding: '4px 8px', borderRadius: 4, background: darkMode ? '#484848' : '#e5e7eb', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 10 }}>Reset</button>
            <button 
              onClick={() => {
                // Generate SVG export of the beat board
                const cards = beatCards.filter(c => c.position);
                if (cards.length === 0) {
                  alert('Aucune carte à exporter');
                  return;
                }
                
                // Calculate bounds
                const padding = 50;
                const cardWidth = 160;
                const cardHeight = 100;
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                cards.forEach(c => {
                  minX = Math.min(minX, c.position.x);
                  minY = Math.min(minY, c.position.y);
                  maxX = Math.max(maxX, c.position.x + cardWidth);
                  maxY = Math.max(maxY, c.position.y + cardHeight);
                });
                
                const width = maxX - minX + padding * 2;
                const height = maxY - minY + padding * 2;
                const offsetX = -minX + padding;
                const offsetY = -minY + padding;
                
                // Build SVG
                let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" style="font-family: system-ui, sans-serif;">`;
                svg += `<rect width="100%" height="100%" fill="${darkMode ? '#2d2d2d' : '#f3f4f6'}"/>`;
                
                // Draw cards
                cards.forEach((card, idx) => {
                  const x = card.position.x + offsetX;
                  const y = card.position.y + offsetY;
                  const bgColor = card.color === '#ffffff' ? (darkMode ? '#3a3a3a' : 'white') : card.color;
                  const textColor = card.color === '#ffffff' ? (darkMode ? 'white' : '#1f2937') : 'white';
                  const borderColor = card.color === '#ffffff' ? (darkMode ? '#555' : '#d1d5db') : card.color;
                  
                  svg += `<rect x="${x}" y="${y}" width="${cardWidth}" height="${cardHeight}" rx="8" fill="${bgColor}" stroke="${borderColor}" stroke-width="1"/>`;
                  
                  // Scene number badge
                  if (card.linkedSceneId) {
                    const sceneNum = elements.filter(el => el.type === 'scene').findIndex(el => el.id === card.linkedSceneId) + 1;
                    svg += `<circle cx="${x + 12}" cy="${y + 12}" r="10" fill="${darkMode ? '#484848' : '#e5e7eb'}"/>`;
                    svg += `<text x="${x + 12}" y="${y + 16}" text-anchor="middle" font-size="9" fill="${darkMode ? 'white' : '#374151'}">${sceneNum}</text>`;
                  }
                  
                  // Title
                  const title = (card.title || '').substring(0, 25) + ((card.title || '').length > 25 ? '...' : '');
                  svg += `<text x="${x + 10}" y="${y + 35}" font-size="11" font-weight="600" fill="${textColor}">${title.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</text>`;
                  
                  // Synopsis
                  if (card.synopsis) {
                    const synopsisLines = (card.synopsis || '').substring(0, 80).split(/(.{30})/g).filter(Boolean).slice(0, 2);
                    synopsisLines.forEach((line, lineIdx) => {
                      svg += `<text x="${x + 10}" y="${y + 52 + lineIdx * 12}" font-size="9" fill="${card.color === '#ffffff' ? '#6b7280' : 'rgba(255,255,255,0.8)'}">${line.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</text>`;
                    });
                  }
                });
                
                svg += '</svg>';
                
                // Download
                const blob = new Blob([svg], { type: 'image/svg+xml' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.download = `beatboard-${new Date().toISOString().slice(0,10)}.svg`;
                link.href = url;
                link.click();
                URL.revokeObjectURL(url);
              }}
              style={{ marginLeft: 4, padding: '4px 8px', borderRadius: 4, background: darkMode ? '#484848' : '#e5e7eb', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}
              title="Exporter en SVG"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              SVG
            </button>
          </div>
        )}
      </div>
      
      {/* Hover preview for timeline blocks - rendered outside timeline to avoid overflow issues */}
      {hoveredBlock && hoveredBlock.card && (
        <div 
          style={{ 
            position: 'fixed', 
            left: hoveredBlock.rect.left + hoveredBlock.rect.width / 2 - 90, // center it (180/2 = 90)
            top: hoveredBlock.rect.bottom + 8,
            zIndex: 1000, 
            pointerEvents: 'none' 
          }}
        >
          <div style={{
            width: 180,
            minHeight: 100,
            background: hoveredBlock.card.color === '#ffffff' ? (darkMode ? '#3a3a3a' : 'white') : hoveredBlock.card.color,
            border: hoveredBlock.card.color === '#ffffff' ? `1px solid ${darkMode ? '#555' : '#d1d5db'}` : 'none',
            borderRadius: 8,
            padding: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
            borderLeft: hoveredBlock.card.color === '#ffffff' ? `4px solid ${darkMode ? '#6b7280' : '#9ca3af'}` : 'none',
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: hoveredBlock.card.color === '#ffffff' ? (darkMode ? 'white' : '#1f2937') : 'white', marginBottom: 6, lineHeight: 1.3 }}>{hoveredBlock.card.title}</div>
            {hoveredBlock.card.synopsis && <div style={{ fontSize: 10, color: hoveredBlock.card.color === '#ffffff' ? (darkMode ? '#9ca3af' : '#6b7280') : 'rgba(255,255,255,0.85)', marginBottom: 6, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{hoveredBlock.card.synopsis}</div>}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9, color: hoveredBlock.card.color === '#ffffff' ? '#9ca3af' : 'rgba(255,255,255,0.7)', borderTop: `1px solid ${hoveredBlock.card.color === '#ffffff' ? (darkMode ? '#555' : '#e5e7eb') : 'rgba(255,255,255,0.2)'}`, paddingTop: 6, marginTop: 4 }}>
              <span>{(hoveredBlock.card.pages || 1).toFixed(1)} pages</span>
              <span>•</span>
              <span>{Math.floor(hoveredBlock.card.pages || 1)}:{String(Math.round(((hoveredBlock.card.pages || 1) % 1) * 60)).padStart(2, '0')}</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Edit Card Modal */}
      {editModalCard && (
        <div 
          style={{ 
            position: 'fixed', 
            inset: 0, 
            background: 'rgba(0,0,0,0.5)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            zIndex: 9999 
          }}
          onClick={() => setEditModalCard(null)}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{ 
              background: darkMode ? '#2a2a2a' : 'white', 
              borderRadius: 12, 
              width: 400, 
              maxWidth: '90vw',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
              overflow: 'hidden'
            }}
          >
            {/* Modal Header with color bar */}
            <div style={{ height: 8, background: editModalCard.color }} />
            <div style={{ padding: 20 }}>
              {/* Scene title (read-only for linked scenes) */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 6 }}>
                  {editModalCard.linkedSceneId ? 'Scène (liée au script)' : 'Titre'}
                </label>
                {editModalCard.linkedSceneId ? (
                  <>
                    <div style={{ fontSize: 14, fontWeight: 600, color: darkMode ? 'white' : 'black', padding: '8px 12px', background: darkMode ? '#1a1a1a' : '#f3f4f6', borderRadius: 6 }}>
                      {editModalCard.title}
                    </div>
                    <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>
                      Le titre vient du script. Modifiez-le dans l'éditeur de script.
                    </div>
                  </>
                ) : (
                  <input
                    value={editModalCard.title}
                    onChange={(e) => {
                      const newTitle = e.target.value;
                      setEditModalCard(prev => ({ ...prev, title: newTitle }));
                      updateCard(editModalCard.id, { title: newTitle });
                    }}
                    style={{ 
                      width: '100%', 
                      padding: '8px 12px', 
                      fontSize: 14, 
                      fontWeight: 600,
                      border: `1px solid ${darkMode ? '#484848' : '#d1d5db'}`, 
                      borderRadius: 6, 
                      background: darkMode ? '#1a1a1a' : 'white',
                      color: darkMode ? 'white' : 'black',
                      outline: 'none'
                    }}
                  />
                )}
              </div>
              
              {/* Synopsis - main editable field */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 6 }}>
                  Résumé de la scène
                </label>
                <textarea
                  autoFocus
                  value={editModalCard.synopsis || ''}
                  onChange={(e) => {
                    const newSynopsis = e.target.value;
                    setEditModalCard(prev => ({ ...prev, synopsis: newSynopsis }));
                    updateCard(editModalCard.id, { synopsis: newSynopsis });
                  }}
                  placeholder="Décrivez cette scène en une phrase..."
                  style={{ 
                    width: '100%', 
                    padding: '10px 12px', 
                    fontSize: 13, 
                    border: `1px solid ${darkMode ? '#484848' : '#d1d5db'}`, 
                    borderRadius: 6, 
                    background: darkMode ? '#1a1a1a' : 'white',
                    color: darkMode ? 'white' : 'black',
                    outline: 'none',
                    resize: 'vertical',
                    minHeight: 80,
                    lineHeight: 1.5
                  }}
                />
                <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>
                  Ce résumé reste dans le Beat Board uniquement
                </div>
              </div>
              
              {/* CUT/UNCUT toggle */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 6 }}>Montage</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => {
                      const newIndex = editModalCard.timelineIndex === null 
                        ? Math.max(-1, ...beatCards.filter(c => c.timelineIndex !== null).map(c => c.timelineIndex)) + 1
                        : null;
                      setEditModalCard(prev => ({ ...prev, timelineIndex: newIndex }));
                      if (newIndex !== null) {
                        setBeatCards(prev => {
                          const maxIdx = Math.max(-1, ...prev.filter(c => c.timelineIndex !== null && c.id !== editModalCard.id).map(c => c.timelineIndex));
                          return prev.map(c => c.id === editModalCard.id ? { ...c, timelineIndex: maxIdx + 1 } : c);
                        });
                      } else {
                        setBeatCards(prev => prev.map(c => c.id === editModalCard.id ? { ...c, timelineIndex: null } : c));
                      }
                    }}
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      borderRadius: 6,
                      border: editModalCard.timelineIndex !== null ? '2px solid #22c55e' : `1px solid ${darkMode ? '#484848' : '#d1d5db'}`,
                      background: editModalCard.timelineIndex !== null ? '#22c55e20' : 'transparent',
                      color: darkMode ? 'white' : 'black',
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6
                    }}
                  >
                    <span>🎬</span> CUT {editModalCard.timelineIndex !== null && '✓'}
                  </button>
                  <button
                    onClick={() => {
                      setEditModalCard(prev => ({ ...prev, timelineIndex: null }));
                      setBeatCards(prev => prev.map(c => c.id === editModalCard.id ? { ...c, timelineIndex: null } : c));
                    }}
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      borderRadius: 6,
                      border: editModalCard.timelineIndex === null ? `2px solid ${darkMode ? '#555' : '#9ca3af'}` : `1px solid ${darkMode ? '#484848' : '#d1d5db'}`,
                      background: editModalCard.timelineIndex === null ? (darkMode ? '#55555530' : '#9ca3af20') : 'transparent',
                      color: darkMode ? 'white' : 'black',
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6
                    }}
                  >
                    UNCUT {editModalCard.timelineIndex === null && '✓'}
                  </button>
                </div>
                <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>
                  {editModalCard.timelineIndex !== null ? 'Cette scène fait partie du montage final' : 'Cette scène est hors montage (mais reste dans le canvas)'}
                </div>
              </div>
              
              {/* Color picker */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 6 }}>Couleur</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {cardColors.map(color => (
                    <button
                      key={color}
                      onClick={() => {
                        setEditModalCard(prev => ({ ...prev, color }));
                        updateCard(editModalCard.id, { color });
                      }}
                      style={{ 
                        width: 28, 
                        height: 28, 
                        borderRadius: 6, 
                        background: color, 
                        border: editModalCard.color === color ? '3px solid white' : 'none',
                        boxShadow: editModalCard.color === color ? `0 0 0 2px ${color}` : 'none',
                        cursor: 'pointer' 
                      }} 
                    />
                  ))}
                </div>
              </div>
              
              {/* Status */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 6 }}>Statut</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[
                    { value: null, label: 'Aucun', icon: '○' },
                    { value: 'progress', label: 'En cours', icon: '◐', bg: '#3b82f6' },
                    { value: 'done', label: 'Terminé', icon: '✓', bg: '#22c55e' },
                    { value: 'urgent', label: 'Urgent', icon: '!', bg: '#ef4444' }
                  ].map(status => (
                    <button
                      key={status.value || 'none'}
                      onClick={() => {
                        setEditModalCard(prev => ({ ...prev, status: status.value }));
                        updateCard(editModalCard.id, { status: status.value });
                      }}
                      style={{ 
                        padding: '6px 12px', 
                        borderRadius: 6, 
                        border: editModalCard.status === status.value ? `2px solid ${status.bg || '#6b7280'}` : `1px solid ${darkMode ? '#484848' : '#d1d5db'}`,
                        background: editModalCard.status === status.value ? (status.bg ? `${status.bg}20` : 'transparent') : 'transparent',
                        color: darkMode ? 'white' : 'black',
                        fontSize: 12,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }} 
                    >
                      <span style={{ color: status.bg || '#6b7280' }}>{status.icon}</span>
                      {status.label}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  onClick={() => setEditModalCard(null)}
                  style={{ 
                    padding: '8px 16px', 
                    borderRadius: 6, 
                    border: 'none',
                    background: '#3b82f6',
                    color: 'white',
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

// ============ USER AVATAR ============
// ============ LOGO ============
const Logo = ({ darkMode }) => {
  const fill = darkMode ? '#ffffff' : '#1a1a1a';
  
  return (
    <svg width="100" height="24" viewBox="0 0 2134.55 520.95" style={{ display: 'block' }}>
      <path fill={fill} d="M1375.76,13.04c14.32,5.69,98.47,254.68,121.6,283.31l112.97-277.01c12.68-15.14,33.62-6.79,49.07-7.06,14.77-.26,61.04-7.48,69.84,4.19,4.61,6.11,4.53,29.77,0,35.77-7.56,10.03-28.35,4.07-39,7-2.48,1.74-4.08,14.51-4.06,18.12.36,116.57-.27,233.47,2.28,349.92.17,7.55-2,25.19,1.94,30.05,8.36,10.32,39.21-3.45,42,19.99,1.83,15.34,2.74,29.51-14.94,31.13-40.63,3.73-86.87-3-128.13-.06-18.94-.43-19.31-34.78-6.86-42.93,12.01-7.85,36.48,1.36,49.92-6.08,7.39-6.33,2.63-101.8,2.73-118.36.49-83.45,2.33-167.05,1.23-250.66-13.19,7.98-13.96,25.34-19.02,37.96-30.91,76.97-61.27,154.18-93.23,230.77l-6.77,5.23c-15.93-2.46-43.8,8.16-53.36-8.55-33.49-74.92-58.04-156.62-90.59-231.41-1.84-4.22-14.6-30.26-16.06-31.94-6.33-7.28-2.86,7.85-2.88,9.07-.18,18.6-.18,37.28-.16,55.96.13,97.27-.46,195.87.22,293.8,3.38,21.41,40.2,4.36,53.83,14.17,9.72,7,11.8,42.18-4.85,43.06-41.13-3.73-89.99,4.63-130.15-.06-16.31-1.91-14.58-17.49-13-31.09,2.75-23.7,28.65-10.34,40.07-17.94,5.85-3.89,3.99-34.07,4.07-42.1,1-96.01-.45-191.68-1.35-287.58-.14-15.29,2.47-33.08,1.42-48.37-.37-5.42-1.38-19.62-6.14-22-22.31-2.68-40.34,5.01-40.84-24.7-.19-11.67,3.26-22.38,15.95-24.15,20.59-2.87,43.51,1.62,63.87,2.05,12.45.26,24.16-5.16,38.41.5Z"/>
      <path fill={fill} d="M286.43,284.45l.92,5.9c47.59,45.43,70.76,111.58,104.96,167.05,11.99,12.91,51.04-6.02,54.08,19.92,1.37,11.73,1.98,29.17-12.93,31.14-13.1,1.74-54.9,1.6-68.19-.02-4.1-.5-7.16-2.23-10.3-4.7-26.72-43-47.94-89.53-74.28-132.74-23.43-38.45-41.46-71.28-91.25-74.75-8.28-.58-68-1.14-69.21,3.32l.05,157.42c18.59,15.1,62.76-9.63,66.07,24.35,1.45,14.87-.73,25.63-16.9,27.09-48.34,4.38-103.14-3.54-152.19,0-23.33.22-22.68-43.52.05-46.14,10.09-1.16,44.89,4.39,47.07-6.93-1.5-16.78,1.71-33.46,2.14-50,2.7-102.59,2.49-215.61-2.26-317.94-.44-9.5,3.1-18.47-.85-27.11C42.04,52.03,1.1,71.5.18,35.36-.72,0,27.41,12.31,51.24,12.41c59.41.24,121-4.19,180.08-2.22,72.39,2.42,134.97,30.66,151.68,106.52,17.4,78.97-22.23,141.87-96.57,167.75ZM125.75,58.76c-10.19,3-2.48,26.43-7.2,34.81,5.11,42.21-.2,85.7.67,128.03.09,4.43.93,24.44,3.01,25.88,14.28,1.55,28.85.94,43.21.96,20.61.04,43.03,1.35,64,0,68.51-4.44,112.65-55.69,96.36-124.53-8.07-34.09-29-50.66-61.89-60.11-41.81-12.03-94.59-2.54-138.16-5.04Z"/>
      <path fill={fill} d="M801.59,117.09c-61.7-81.87-175.67-94.6-248.04-18.52-76.94,80.88-79.51,229.73-6.23,313.82,61.54,70.63,159.06,80.79,231.75,20.12,2.76.47,23.39,26.93,28.26,31.79,2.89,2.89,10.83,4.74,8.12,10.07-78.51,60.99-194.74,60.7-276.93,6.82C316.78,335.82,429.58-34.34,707.06,2.64c183,24.39,267.14,244.23,176.28,395.68-8.87.18-36.31-60.4-38.87-71.08-4.04-16.85,2.75-31.3,3.84-47.91,3.6-54.63-13.76-118.5-46.73-162.25Z"/>
      <path fill={fill} d="M782.31,122.36c8.65,16.11,20.52,30.26,27.78,47.25,16.02,37.48,8.22,42.96,6.19,79.86-6.42,116.53,79.85,246.8,210.17,220,132.09-27.16,174.18-202.7,122.86-313.08-49.38-106.21-170.67-147.73-261.97-64.07l-36.91-44.74c94.39-71.95,234.86-60.68,317.96,23.73,159.9,162.4,48.1,465.1-191.03,449.03-179.17-12.04-278.99-202.66-213.96-363.92,1.38-3.42,15.5-36.38,18.91-34.06Z"/>
      <path fill={fill} d="M2068.31,30.35c2.2-25.54,32.49-34.92,46.85-14.22,2.04,30.93,1.32,62.24,1.08,93.31-.1,13.19,2.16,28.39-.02,41.81-2.42,14.93-32.56,13.95-40.94,7.17-7.87-6.36-6.13-37.86-9.96-50.04-25.48-81.1-179.82-81.42-200.4,3.57-22.69,93.73,66.31,103.51,131.41,123.42,40.73,12.45,91.94,28.18,116.5,65.5,6.64,10.08,20.91,41.42,21.4,52.78,1.85,43.46-3.98,83.39-34.87,116.75-50.47,54.49-147.74,59.69-213.58,33.53-7.7-3.06-31.22-18.09-36.39-17.69-8.08.63-5.99,13.76-9.25,18.95-7.43,11.85-48.32,11.37-45.81-9.82,1.66-45.85-5.21-91.5.87-137.11,4.28-12.97,34.6-12.78,41.21-2.97,6.02,8.94,6.61,34.58,10.95,47.05,32.88,94.53,221.15,96.18,230.94-16.98,8.16-94.36-133.38-98.22-196.4-127.57-66.84-31.13-91.39-93.92-69.01-163.86,24.44-76.38,112.99-103.54,185.85-90.98,26.12,4.5,46.43,15.64,69.55,27.41Z"/>
    </svg>
  );
};

const UserAvatar = ({ user, isYou }) => {
  const getInitials = (name) => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };
  return (
    <div style={{ width: 28, height: 28, borderRadius: '50%', background: user.color || '#666', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 'bold', color: 'white', border: isYou ? '2px solid #22c55e' : 'none', boxSizing: 'border-box' }} title={user.name}>{getInitials(user.name)}</div>
  );
};

// Script templates
const SCRIPT_TEMPLATES = {
  empty: {
    name: 'Document vide',
    icon: '📄',
    description: 'Commencer de zéro',
    elements: [
      { type: 'scene', content: 'INT. LIEU - JOUR' },
      { type: 'action', content: '' }
    ]
  },
  threeActs: {
    name: 'Structure 3 Actes',
    icon: '🎭',
    description: 'Setup, Confrontation, Résolution',
    elements: [
      { type: 'scene', content: '=== ACTE 1 - SETUP ===' },
      { type: 'action', content: '[Le monde ordinaire du protagoniste. Présentation des personnages et de l\'univers.]' },
      { type: 'scene', content: 'INT. LIEU DE VIE DU HÉROS - JOUR' },
      { type: 'action', content: '[Introduction du protagoniste dans son quotidien]' },
      { type: 'scene', content: 'INT./EXT. LIEU - JOUR/NUIT' },
      { type: 'action', content: '[L\'incident déclencheur qui bouleverse l\'équilibre]' },
      { type: 'scene', content: '=== ACTE 2 - CONFRONTATION ===' },
      { type: 'action', content: '[Le protagoniste fait face aux obstacles. Montée des enjeux.]' },
      { type: 'scene', content: 'INT./EXT. NOUVEAU MONDE - JOUR' },
      { type: 'action', content: '[Le héros entre dans un nouveau monde / nouvelle situation]' },
      { type: 'scene', content: 'INT./EXT. LIEU - JOUR/NUIT' },
      { type: 'action', content: '[Tests, alliés, ennemis. Le héros apprend les règles.]' },
      { type: 'scene', content: 'INT./EXT. LIEU - JOUR/NUIT' },
      { type: 'action', content: '[MIDPOINT - Fausse victoire ou fausse défaite]' },
      { type: 'scene', content: 'INT./EXT. LIEU - JOUR/NUIT' },
      { type: 'action', content: '[Les enjeux augmentent. Le héros perd tout espoir.]' },
      { type: 'scene', content: '=== ACTE 3 - RÉSOLUTION ===' },
      { type: 'action', content: '[Le climax et la résolution finale.]' },
      { type: 'scene', content: 'INT./EXT. LIEU DU CLIMAX - JOUR/NUIT' },
      { type: 'action', content: '[Confrontation finale. Le héros utilise tout ce qu\'il a appris.]' },
      { type: 'scene', content: 'INT./EXT. LIEU - JOUR' },
      { type: 'action', content: '[Résolution. Le nouveau monde ordinaire du héros.]' }
    ]
  },
  fiveActs: {
    name: 'Structure 5 Actes',
    icon: '🎪',
    description: 'Shakespeare / Tragédie classique',
    elements: [
      { type: 'scene', content: '=== ACTE 1 - EXPOSITION ===' },
      { type: 'action', content: '[Présentation du monde, des personnages et du conflit latent]' },
      { type: 'scene', content: 'INT./EXT. LIEU - JOUR' },
      { type: 'action', content: '' },
      { type: 'scene', content: '=== ACTE 2 - MONTÉE DE L\'ACTION ===' },
      { type: 'action', content: '[L\'événement déclencheur. Les complications commencent.]' },
      { type: 'scene', content: 'INT./EXT. LIEU - JOUR/NUIT' },
      { type: 'action', content: '' },
      { type: 'scene', content: '=== ACTE 3 - CLIMAX ===' },
      { type: 'action', content: '[Le point de non-retour. La crise atteint son paroxysme.]' },
      { type: 'scene', content: 'INT./EXT. LIEU - JOUR/NUIT' },
      { type: 'action', content: '' },
      { type: 'scene', content: '=== ACTE 4 - CHUTE ===' },
      { type: 'action', content: '[Les conséquences du climax. Tout s\'effondre ou se reconstruit.]' },
      { type: 'scene', content: 'INT./EXT. LIEU - JOUR/NUIT' },
      { type: 'action', content: '' },
      { type: 'scene', content: '=== ACTE 5 - DÉNOUEMENT ===' },
      { type: 'action', content: '[La résolution finale. Catharsis.]' },
      { type: 'scene', content: 'INT./EXT. LIEU - JOUR' },
      { type: 'action', content: '' }
    ]
  },
  herosJourney: {
    name: 'Le Voyage du Héros',
    icon: '🗡️',
    description: 'Joseph Campbell - 12 étapes',
    elements: [
      { type: 'scene', content: '=== 1. LE MONDE ORDINAIRE ===' },
      { type: 'action', content: '[Le héros dans son environnement quotidien avant l\'aventure]' },
      { type: 'scene', content: 'INT. MAISON DU HÉROS - JOUR' },
      { type: 'action', content: '' },
      { type: 'scene', content: '=== 2. L\'APPEL DE L\'AVENTURE ===' },
      { type: 'action', content: '[Un problème ou un défi se présente au héros]' },
      { type: 'scene', content: 'INT./EXT. LIEU - JOUR/NUIT' },
      { type: 'action', content: '' },
      { type: 'scene', content: '=== 3. LE REFUS DE L\'APPEL ===' },
      { type: 'action', content: '[Le héros hésite, a peur de l\'inconnu]' },
      { type: 'scene', content: 'INT. LIEU - JOUR/NUIT' },
      { type: 'action', content: '' },
      { type: 'scene', content: '=== 4. LA RENCONTRE AVEC LE MENTOR ===' },
      { type: 'action', content: '[Un guide apparaît pour aider le héros]' },
      { type: 'scene', content: 'INT./EXT. LIEU - JOUR' },
      { type: 'action', content: '' },
      { type: 'scene', content: '=== 5. LE PASSAGE DU SEUIL ===' },
      { type: 'action', content: '[Le héros s\'engage dans l\'aventure, quitte le monde ordinaire]' },
      { type: 'scene', content: 'EXT. FRONTIÈRE/SEUIL - JOUR' },
      { type: 'action', content: '' },
      { type: 'scene', content: '=== 6. ÉPREUVES, ALLIÉS, ENNEMIS ===' },
      { type: 'action', content: '[Le héros fait face à des tests, rencontre des alliés et des ennemis]' },
      { type: 'scene', content: 'INT./EXT. MONDE SPÉCIAL - JOUR/NUIT' },
      { type: 'action', content: '' },
      { type: 'scene', content: '=== 7. L\'APPROCHE DE LA CAVERNE ===' },
      { type: 'action', content: '[Préparation pour le défi majeur]' },
      { type: 'scene', content: 'INT./EXT. APPROCHE DU DANGER - NUIT' },
      { type: 'action', content: '' },
      { type: 'scene', content: '=== 8. L\'ÉPREUVE SUPRÊME ===' },
      { type: 'action', content: '[Le héros affronte sa plus grande peur, mort symbolique]' },
      { type: 'scene', content: 'INT. CAVERNE/LIEU DU DANGER - NUIT' },
      { type: 'action', content: '' },
      { type: 'scene', content: '=== 9. LA RÉCOMPENSE ===' },
      { type: 'action', content: '[Le héros s\'empare du trésor/élixir après l\'épreuve]' },
      { type: 'scene', content: 'INT./EXT. LIEU - JOUR' },
      { type: 'action', content: '' },
      { type: 'scene', content: '=== 10. LE CHEMIN DU RETOUR ===' },
      { type: 'action', content: '[Le héros doit rentrer avec ce qu\'il a gagné]' },
      { type: 'scene', content: 'EXT. CHEMIN DU RETOUR - JOUR' },
      { type: 'action', content: '' },
      { type: 'scene', content: '=== 11. LA RÉSURRECTION ===' },
      { type: 'action', content: '[Ultime épreuve, transformation finale du héros]' },
      { type: 'scene', content: 'INT./EXT. LIEU DU CLIMAX - JOUR' },
      { type: 'action', content: '' },
      { type: 'scene', content: '=== 12. LE RETOUR AVEC L\'ÉLIXIR ===' },
      { type: 'action', content: '[Le héros revient transformé avec le pouvoir de changer son monde]' },
      { type: 'scene', content: 'INT. MONDE ORDINAIRE - JOUR' },
      { type: 'action', content: '' }
    ]
  },
  saveTheCat: {
    name: 'Save the Cat',
    icon: '🐱',
    description: 'Blake Snyder - 15 beats',
    elements: [
      { type: 'scene', content: '=== 1. IMAGE D\'OUVERTURE (p.1) ===' },
      { type: 'action', content: '[L\'image qui donne le ton. Miroir de l\'image finale.]' },
      { type: 'scene', content: 'INT./EXT. LIEU - JOUR/NUIT' },
      { type: 'action', content: '' },
      { type: 'scene', content: '=== 2. THÈME ÉNONCÉ (p.5) ===' },
      { type: 'action', content: '[Quelqu\'un dit au héros ce que sera sa leçon de vie]' },
      { type: 'scene', content: 'INT./EXT. LIEU - JOUR' },
      { type: 'action', content: '' },
      { type: 'scene', content: '=== 3. SET-UP (p.1-10) ===' },
      { type: 'action', content: '[Le monde "avant". Tout ce qui doit être fixé. Les 6 choses qui doivent être améliorées.]' },
      { type: 'scene', content: 'INT./EXT. LIEU - JOUR' },
      { type: 'action', content: '' },
      { type: 'scene', content: '=== 4. CATALYSEUR (p.12) ===' },
      { type: 'action', content: '[L\'événement qui change tout. Télégramme, rencontre, découverte...]' },
      { type: 'scene', content: 'INT./EXT. LIEU - JOUR' },
      { type: 'action', content: '' },
      { type: 'scene', content: '=== 5. DÉBAT (p.12-25) ===' },
      { type: 'action', content: '[Le héros doute. Dernière chance de refuser l\'aventure.]' },
      { type: 'scene', content: 'INT./EXT. LIEU - JOUR/NUIT' },
      { type: 'action', content: '' },
      { type: 'scene', content: '=== 6. PASSAGE À L\'ACTE 2 (p.25) ===' },
      { type: 'action', content: '[Le héros choisit d\'agir. Il entre dans un monde inversé.]' },
      { type: 'scene', content: 'INT./EXT. NOUVEAU MONDE - JOUR' },
      { type: 'action', content: '' },
      { type: 'scene', content: '=== 7. HISTOIRE B (p.30) ===' },
      { type: 'action', content: '[L\'histoire d\'amour ou l\'histoire du thème. Nouveaux personnages.]' },
      { type: 'scene', content: 'INT./EXT. LIEU - JOUR' },
      { type: 'action', content: '' },
      { type: 'scene', content: '=== 8. FUN AND GAMES (p.30-55) ===' },
      { type: 'action', content: '[La promesse du concept. Ce pourquoi le public est venu.]' },
      { type: 'scene', content: 'INT./EXT. LIEU - JOUR/NUIT' },
      { type: 'action', content: '' },
      { type: 'scene', content: '=== 9. MIDPOINT (p.55) ===' },
      { type: 'action', content: '[Fausse victoire ou fausse défaite. Les enjeux montent. Horloge activée.]' },
      { type: 'scene', content: 'INT./EXT. LIEU - JOUR/NUIT' },
      { type: 'action', content: '' },
      { type: 'scene', content: '=== 10. LES MÉCHANTS SE RAPPROCHENT (p.55-75) ===' },
      { type: 'action', content: '[Les forces antagonistes se regroupent. L\'équipe du héros se désagrège.]' },
      { type: 'scene', content: 'INT./EXT. LIEU - JOUR/NUIT' },
      { type: 'action', content: '' },
      { type: 'scene', content: '=== 11. TOUT EST PERDU (p.75) ===' },
      { type: 'action', content: '[L\'opposé du Midpoint. Mort du mentor. Tout semble fini.]' },
      { type: 'scene', content: 'INT./EXT. LIEU - NUIT' },
      { type: 'action', content: '' },
      { type: 'scene', content: '=== 12. LA NUIT NOIRE DE L\'ÂME (p.75-85) ===' },
      { type: 'action', content: '[Le héros est au plus bas. Moment de réflexion profonde.]' },
      { type: 'scene', content: 'INT. LIEU ISOLÉ - NUIT' },
      { type: 'action', content: '' },
      { type: 'scene', content: '=== 13. PASSAGE À L\'ACTE 3 (p.85) ===' },
      { type: 'action', content: '[Eureka! La solution vient de l\'histoire B et du thème.]' },
      { type: 'scene', content: 'INT./EXT. LIEU - AUBE' },
      { type: 'action', content: '' },
      { type: 'scene', content: '=== 14. FINALE (p.85-110) ===' },
      { type: 'action', content: '[Le héros applique sa leçon. Confrontation finale. Nouveau monde créé.]' },
      { type: 'scene', content: 'INT./EXT. LIEU DU CLIMAX - JOUR' },
      { type: 'action', content: '' },
      { type: 'scene', content: '=== 15. IMAGE FINALE (p.110) ===' },
      { type: 'action', content: '[L\'opposé de l\'image d\'ouverture. Preuve que le changement a eu lieu.]' },
      { type: 'scene', content: 'INT./EXT. LIEU - JOUR' },
      { type: 'action', content: '' }
    ]
  },
  sequence: {
    name: 'Approche Séquentielle',
    icon: '🎬',
    description: '8 séquences de 12-15 pages',
    elements: [
      { type: 'scene', content: '=== SÉQUENCE 1 - STATUS QUO & INCIDENT (p.1-12) ===' },
      { type: 'action', content: '[Le monde du protagoniste. L\'incident déclencheur arrive à la fin.]' },
      { type: 'scene', content: 'INT./EXT. LIEU - JOUR' },
      { type: 'action', content: '' },
      { type: 'scene', content: '=== SÉQUENCE 2 - PRÉDICAMENT (p.12-25) ===' },
      { type: 'action', content: '[Le héros réagit à l\'incident. Il formule son but.]' },
      { type: 'scene', content: 'INT./EXT. LIEU - JOUR' },
      { type: 'action', content: '' },
      { type: 'scene', content: '=== SÉQUENCE 3 - PREMIÈRE TENTATIVE (p.25-37) ===' },
      { type: 'action', content: '[Première vraie tentative pour résoudre le problème.]' },
      { type: 'scene', content: 'INT./EXT. LIEU - JOUR/NUIT' },
      { type: 'action', content: '' },
      { type: 'scene', content: '=== SÉQUENCE 4 - PLUS GRAND OBSTACLE (p.37-50) ===' },
      { type: 'action', content: '[Les enjeux augmentent. Échec de la première approche.]' },
      { type: 'scene', content: 'INT./EXT. LIEU - JOUR/NUIT' },
      { type: 'action', content: '' },
      { type: 'scene', content: '=== SÉQUENCE 5 - PREMIER CLIMAX (p.50-62) ===' },
      { type: 'action', content: '[Point central. Le héros semble réussir ou échouer spectaculairement.]' },
      { type: 'scene', content: 'INT./EXT. LIEU - JOUR/NUIT' },
      { type: 'action', content: '' },
      { type: 'scene', content: '=== SÉQUENCE 6 - NOUVELLES COMPLICATIONS (p.62-75) ===' },
      { type: 'action', content: '[Les conséquences du midpoint créent de nouveaux problèmes.]' },
      { type: 'scene', content: 'INT./EXT. LIEU - JOUR/NUIT' },
      { type: 'action', content: '' },
      { type: 'scene', content: '=== SÉQUENCE 7 - SECOND CLIMAX (p.75-87) ===' },
      { type: 'action', content: '[Tout est perdu. Le héros touche le fond.]' },
      { type: 'scene', content: 'INT./EXT. LIEU - NUIT' },
      { type: 'action', content: '' },
      { type: 'scene', content: '=== SÉQUENCE 8 - RÉSOLUTION (p.87-110) ===' },
      { type: 'action', content: '[Climax final et résolution. Le héros triomphe ou échoue définitivement.]' },
      { type: 'scene', content: 'INT./EXT. LIEU - JOUR' },
      { type: 'action', content: '' }
    ]
  }
};

// ============ MAIN EDITOR ============
export default function ScreenplayEditor() {
  const getDocId = () => { const hash = window.location.hash; return hash.startsWith('#') ? hash.slice(1) : null; };
  const [docId, setDocId] = useState(getDocId);
  const [title, setTitle] = useState('SANS TITRE');
  const [elements, setElements] = useState([{ id: generateId(), type: 'scene', content: '' }]);
  const [beatCards, setBeatCards] = useState([]); // Beat Board cards - shared with Outline
  const [whiteboardElements, setWhiteboardElements] = useState([]); // Excalidraw whiteboard elements
  const [activeIndex, setActiveIndex] = useState(0);
  // V272: cursorOffset supprimé (curseur géré par TipTap)
  const [characters, setCharacters] = useState([]);
  const [comments, setComments] = useState([]);
  const [suggestions, setSuggestions] = useState([]); // { id, elementId, elementIndex, originalText, suggestedText, startOffset, endOffset, userName, userColor, createdAt, status: 'pending'|'accepted'|'rejected' }
  const [textSelection, setTextSelection] = useState(null); // { elementId, elementIndex, text, startOffset, endOffset, rect }
  const [pendingInlineComment, setPendingInlineComment] = useState(null); // { elementId, elementIndex, text, startOffset, endOffset }
  const [pendingSuggestion, setPendingSuggestion] = useState(null); // { elementId, elementIndex, originalText, startOffset, endOffset }
  const [scriptHasFocus, setScriptHasFocus] = useState(false); // Track if script area has focus
  const [contextMenuTop, setContextMenuTop] = useState(null); // Fixed Y position for context menu
  const [selectedRange, setSelectedRange] = useState(null); // { start: number, end: number }
  const copiedBlocksRef = useRef(null); // stores blocks from multi-block copy for reliable internal paste
  const [isDragSelecting, setIsDragSelecting] = useState(false); // mouse drag selection in progress
  const dragStartIndexRef = useRef(null); // starting block index for drag selection for multi-block selection
  const [connected, setConnected] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [offlineDocId, setOfflineDocId] = useState(null); // null = not in offline mode
  const [offlineSnapshot, setOfflineSnapshot] = useState(null); // {elements, title, timestamp, serverUpdatedAt}
  const [showConflictModal, setShowConflictModal] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [conflictServerUpdatedAt, setConflictServerUpdatedAt] = useState(null);
  const [users, setUsers] = useState([]);
  const [myId, setMyId] = useState(null);
  const [myRole, setMyRole] = useState('editor');
  const [isOwner, setIsOwner] = useState(false);
  const [currentUser, setCurrentUser] = useState(() => { const s = localStorage.getItem('screenplay-user'); return s ? JSON.parse(s) : null; });
  const [token, setToken] = useState(() => localStorage.getItem('screenplay-token'));
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showDocsList, setShowDocsList] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [selectedCommentIndex, setSelectedCommentIndex] = useState(null); // Index of element whose comment was clicked
  const [selectedCommentId, setSelectedCommentId] = useState(null); // ID of selected comment (for expanding)
  const [selectedSuggestionId, setSelectedSuggestionId] = useState(null); // ID of selected suggestion (for expanding)
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [scriptFont, setScriptFont] = useState(() => localStorage.getItem('rooms-script-font') || 'courier-prime');
  const [language, setLanguage] = useState(() => localStorage.getItem('rooms-language') || 'fr');
  
  // Translation function
  const t = useCallback((key) => {
    return translations[language]?.[key] || translations['fr']?.[key] || key;
  }, [language]);
  
  // Save language preference
  useEffect(() => {
    localStorage.setItem('rooms-language', language);
  }, [language]);

  // ============ DESKTOP MODE: auto-login + dynamic SERVER_URL ============
  const [desktopReady, setDesktopReady] = useState(!IS_DESKTOP); // web = ready immediately
  useEffect(() => {
    if (!IS_DESKTOP) return;
    let cancelled = false;
    (async () => {
      try {
        const port = await window.electronAPI.getServerPort();
        SERVER_URL = `http://127.0.0.1:${port}`;
        const localUser = await window.electronAPI.getLocalUser();
        if (!cancelled) {
          setToken('local');
          setCurrentUser({ id: localUser._id, name: localUser.name, email: localUser.email, color: localUser.color });
          setMyRole('editor');
          setIsOwner(true);
          setDesktopReady(true);
          console.log('[DESKTOP] Ready — server at', SERVER_URL);
        }
      } catch (err) {
        console.error('[DESKTOP] Init failed:', err);
        if (!cancelled) setDesktopReady(true); // fallback: show UI anyway
      }
    })();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Desktop menu actions — ref populated later (after function definitions)
  const desktopMenuRef = useRef({});
  
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const [showOutline, setShowOutline] = useState(false);
  const [showSceneNumbers, setShowSceneNumbers] = useState(false);
  const [notes, setNotes] = useState({}); // { elementId: { content, color } }
  const [showNoteFor, setShowNoteFor] = useState(null);
  const [showCharactersPanel, setShowCharactersPanel] = useState(false);
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const [showDocMenu, setShowDocMenu] = useState(false);
  const [showImportSubmenu, setShowImportSubmenu] = useState(false);
  const [showExportSubmenu, setShowExportSubmenu] = useState(false);
  const [showLanguageSubmenu, setShowLanguageSubmenu] = useState(false);
  const [lockedScenes, setLockedScenes] = useState(new Set()); // Set of scene element IDs
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const [showRenameChar, setShowRenameChar] = useState(false);
  // renameFrom/renameTo removed — unused
  const [focusMode, setFocusMode] = useState(false);
  const [sceneAssignments, setSceneAssignments] = useState({}); // { sceneId: { userId, userName, userColor } }
  const [assignmentMenu, setAssignmentMenu] = useState(null); // { sceneId, x, y }
  const [collaborators, setCollaborators] = useState([]); // All users who have access to this document
  const [showTimer, setShowTimer] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerMode, setTimerMode] = useState('chrono'); // 'chrono' or 'sprint'
  const [sprintDuration, setSprintDuration] = useState(25 * 60); // 25 minutes default
  const [sprintTimeLeft, setSprintTimeLeft] = useState(25 * 60);
  const [sessionWordCount, setSessionWordCount] = useState(0);
  const [sessionStartWords, setSessionStartWords] = useState(0);
  const [sceneStatus, setSceneStatus] = useState({}); // { sceneId: 'draft' | 'review' | 'final' }
  const [outlineFilter, setOutlineFilter] = useState({ status: '', assignee: '' });
  const [showStatusDropdown, setShowStatusDropdown] = useState(false); // Custom dropdown for status filter
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false); // Custom dropdown for assignee filter
  const [structureBeats, setStructureBeats] = useState([]); // { id, label, startSceneId, color } - unified structure for timeline and outline
  // editingChapter removed — unused
  const [lastSaved, setLastSaved] = useState(null);
  const [, setLastModifiedBy] = useState(null); // { userName, timestamp }
  const [, setUndoStack] = useState([]);
  const [, setRedoStack] = useState([]);
  // draggedScene removed — unused
  const [outlineDragIndex, setOutlineDragIndex] = useState(null); // Scene index being dragged in outline
  const [outlineDropIndex, setOutlineDropIndex] = useState(null); // Drop target index in outline
  const [sceneSynopsis, setSceneSynopsis] = useState({}); // { sceneId: 'synopsis text' }
  // visibleElementIndex removed — unused
  const [elementPositions, setElementPositions] = useState({}); // { elementIndex: topPosition }
  const [scriptScrollHeight, setScriptScrollHeight] = useState(0);
  const [writingGoal, setWritingGoal] = useState(() => {
    const saved = localStorage.getItem('rooms-writing-goal');
    return saved ? JSON.parse(saved) : { daily: 1000, todayWords: 0, lastDate: null };
  });
  const [showGoToScene, setShowGoToScene] = useState(false);
  // editingSynopsis removed — unused
  // eslint-disable-next-line no-unused-vars
  const [typewriterSound, setTypewriterSound] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [activeView, setActiveView] = useState('script'); // 'script' | 'beatboard'
  
  // AI Rewrite states
  const [showAIRewrite, setShowAIRewrite] = useState(false);
  const [aiRewriteSelection, setAiRewriteSelection] = useState(null); // { elementId, elementIndex, text, startOffset, endOffset }
  const [aiRewriteMode, setAiRewriteMode] = useState(null); // 'concis', 'develop', 'reformulate', 'tone', 'custom'
  const [aiRewriteCustomPrompt, setAiRewriteCustomPrompt] = useState('');
  const [aiRewriteResult, setAiRewriteResult] = useState(null);
  const [aiRewriteLoading, setAiRewriteLoading] = useState(false);
  const [aiRewriteTone, setAiRewriteTone] = useState('dramatique'); // for tone mode
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [chatNotificationSound, setChatNotificationSound] = useState(true);
  const [chatPosition, setChatPosition] = useState({ x: window.innerWidth - 340, y: 80 });
  const [notePosition, setNotePosition] = useState({ x: window.innerWidth / 2 - 200, y: window.innerHeight / 2 - 150 });
  const [timerPosition, setTimerPosition] = useState({ x: window.innerWidth - 260, y: window.innerHeight - 350 });
  const [timerCompact, setTimerCompact] = useState(false);
  const [isDraggingChat, setIsDraggingChat] = useState(false);
  const [isDraggingNote, setIsDraggingNote] = useState(false);
  const [isDraggingTimer, setIsDraggingTimer] = useState(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const socketRef = useRef(null);
  const loadedDocRef = useRef(null);
  const offlineDocIdRef = useRef(null);
  const scriptContainerRef = useRef(null);
  const outlineSidebarRef = useRef(null);
  const commentsSidebarRef = useRef(null);
  const chatEndRef = useRef(null);
  const chatNotificationSoundRef = useRef(chatNotificationSound);
  
  // Keep ref in sync
  useEffect(() => {
    chatNotificationSoundRef.current = chatNotificationSound;
  }, [chatNotificationSound]);

  // Simple 1:1 scroll sync between Script and Comments (like they're glued together)
  // + Scene-based sync between Script and Outline
  // Scroll sync for script <-> comments <-> outline (works on all browsers including Safari)
  useEffect(() => {
    const script = scriptContainerRef.current;
    if (!script) return;

    const isSafariSync = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

    // Use a timestamp-based lock instead of RAF flag to prevent scroll loops on Safari
    // Safari fires scroll events asynchronously, so RAF-based flags can miss the loop
    let scrollSource = null; // 'script' | 'comments' | 'outline' | null
    let lockTimeout = null;
    const LOCK_MS = isSafariSync ? 60 : 0; // Safari needs a brief lock window

    const acquireLock = (source) => {
      if (scrollSource && scrollSource !== source) return false;
      scrollSource = source;
      if (lockTimeout) clearTimeout(lockTimeout);
      lockTimeout = setTimeout(() => { scrollSource = null; }, LOCK_MS);
      return true;
    };

    let outlineRAF = null;
    let lastTopScene = null;

    const findTopSceneInScript = () => {
      const scriptRect = script.getBoundingClientRect();
      const sceneElements = script.querySelectorAll('[data-element-id]');

      for (const el of sceneElements) {
        const elId = el.getAttribute('data-element-id');
        const idx = elementsRef.current.findIndex(e => e.id === elId);
        if (idx === -1 || elementsRef.current[idx]?.type !== 'scene') continue;

        const rect = el.getBoundingClientRect();
        if (rect.top >= scriptRect.top - 50 && rect.top <= scriptRect.top + 150) {
          return idx;
        }
        if (rect.bottom > scriptRect.top + 50) {
          return idx;
        }
      }
      return null;
    };

    const findTopSceneInOutline = () => {
      const outline = outlineSidebarRef.current;
      if (!outline) return null;
      const outlineRect = outline.getBoundingClientRect();
      const sceneElements = outline.querySelectorAll('[data-outline-element-index]');

      for (const el of sceneElements) {
        const rect = el.getBoundingClientRect();
        if (rect.top >= outlineRect.top - 20 && rect.top <= outlineRect.top + 80) {
          return parseInt(el.getAttribute('data-outline-element-index'), 10);
        }
        if (rect.bottom > outlineRect.top + 20) {
          return parseInt(el.getAttribute('data-outline-element-index'), 10);
        }
      }
      return null;
    };

    const scrollOutlineToScene = (sceneIndex) => {
      const outline = outlineSidebarRef.current;
      if (!outline) return;
      const sceneEl = outline.querySelector(`[data-outline-element-index="${sceneIndex}"]`);
      if (sceneEl) {
        const outlineRect = outline.getBoundingClientRect();
        const sceneRect = sceneEl.getBoundingClientRect();
        const targetScroll = outline.scrollTop + (sceneRect.top - outlineRect.top) - 10;
        outline.scrollTop = Math.max(0, targetScroll);
      }
    };

    const scrollScriptToScene = (sceneIndex) => {
      const sceneId = elementsRef.current[sceneIndex]?.id;
      const sceneEl = sceneId ? script.querySelector(`[data-element-id="${sceneId}"]`) : null;
      if (sceneEl) {
        const scriptRect = script.getBoundingClientRect();
        const sceneRect = sceneEl.getBoundingClientRect();
        const targetScroll = script.scrollTop + (sceneRect.top - scriptRect.top) - 32;
        script.scrollTop = Math.max(0, targetScroll);
      }
    };

    const handleScriptScroll = () => {
      if (!acquireLock('script')) return;

      const comments = commentsSidebarRef.current;
      const outline = outlineSidebarRef.current;

      // 1:1 sync with comments
      if (comments) {
        comments.scrollTop = script.scrollTop;
      }

      // Scene-based sync with outline (throttled)
      if (outline) {
        if (outlineRAF) cancelAnimationFrame(outlineRAF);
        outlineRAF = requestAnimationFrame(() => {
          const topScene = findTopSceneInScript();
          if (topScene !== null && topScene !== lastTopScene) {
            lastTopScene = topScene;
            scrollOutlineToScene(topScene);
          }
        });
      }
    };

    const handleCommentsScroll = () => {
      if (!acquireLock('comments')) return;
      script.scrollTop = commentsSidebarRef.current.scrollTop;
    };

    const handleOutlineScroll = () => {
      if (!acquireLock('outline')) return;

      if (outlineRAF) cancelAnimationFrame(outlineRAF);
      outlineRAF = requestAnimationFrame(() => {
        const topScene = findTopSceneInOutline();
        if (topScene !== null && topScene !== lastTopScene) {
          lastTopScene = topScene;
          scrollScriptToScene(topScene);
        }
      });
    };

    // Attach listeners
    script.addEventListener('scroll', handleScriptScroll, { passive: true });

    let commentsListener = null;
    let outlineListener = null;

    const attachListeners = () => {
      const comments = commentsSidebarRef.current;
      const outline = outlineSidebarRef.current;

      if (comments && !commentsListener) {
        commentsListener = handleCommentsScroll;
        comments.addEventListener('scroll', commentsListener, { passive: true });
      }
      if (outline && !outlineListener) {
        outlineListener = handleOutlineScroll;
        outline.addEventListener('scroll', outlineListener, { passive: true });
      }
    };

    attachListeners();
    const attachTimeout = setTimeout(attachListeners, 100);
    const attachTimeout2 = setTimeout(attachListeners, 500);

    const commentsEl = commentsSidebarRef.current;
    const outlineEl = outlineSidebarRef.current;

    return () => {
      script.removeEventListener('scroll', handleScriptScroll);
      if (commentsEl && commentsListener) {
        commentsEl.removeEventListener('scroll', commentsListener);
      }
      if (outlineEl && outlineListener) {
        outlineEl.removeEventListener('scroll', outlineListener);
      }
      if (outlineRAF) cancelAnimationFrame(outlineRAF);
      if (lockTimeout) clearTimeout(lockTimeout);
      clearTimeout(attachTimeout);
      clearTimeout(attachTimeout2);
    };
  }, [showComments, showOutline]);

  // Track script's scrollHeight for comments sidebar min-height
  useEffect(() => {
    const script = scriptContainerRef.current;
    if (!script) return;
    
    // Detect Safari
    const safariDetected = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    let throttleTimeout = null;
    
    const updateHeight = () => {
      // Throttle on Safari
      if (safariDetected) {
        if (throttleTimeout) return;
        throttleTimeout = setTimeout(() => {
          throttleTimeout = null;
          setScriptScrollHeight(script.scrollHeight);
        }, 500);
      } else {
        setScriptScrollHeight(script.scrollHeight);
      }
    };
    
    updateHeight();
    
    // On Safari, use interval instead of ResizeObserver (much less CPU)
    if (safariDetected) {
      const interval = setInterval(() => {
        setScriptScrollHeight(script.scrollHeight);
      }, 2000);
      return () => {
        clearInterval(interval);
        if (throttleTimeout) clearTimeout(throttleTimeout);
      };
    }
    
    // Use ResizeObserver on Chrome/Firefox
    const observer = new ResizeObserver(updateHeight);
    observer.observe(script);
    
    return () => observer.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ResizeObserver auto-detects size changes, no need to reconnect on elements.length
  
  // Chat notification audio - Web Audio synthesis (reuse single AudioContext)
  const audioCtxRef = useRef(null);
  const playChatNotification = useCallback(() => {
    if (!chatNotificationSoundRef.current) return;
    try {
      // Reuse or create a single AudioContext
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      // Resume if suspended (browser autoplay policy)
      if (ctx.state === 'suspended') ctx.resume();
      const now = ctx.currentTime;

      // Create pleasant notification chime (two notes)
      [880, 1100].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.3, now + i * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.1);
        osc.stop(now + i * 0.1 + 0.2);
      });
    } catch (e) {}
  }, []);

  useEffect(() => {
    const handleHash = () => { 
      const newDocId = window.location.hash.slice(1) || null;
      if (newDocId !== docId) {
        loadedDocRef.current = null;
        setDocId(newDocId);
      }
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, [docId]);

  // If trying to access a document without being logged in, show auth modal
  // but KEEP the docId/hash so it loads after login
  const pendingDocIdRef = useRef(null);
  useEffect(() => {
    if (docId && docId !== 'local' && !token) {
      pendingDocIdRef.current = docId;
      setShowAuthModal(true);
      // Don't let loadDocument run without auth — it would fail with 403
      // and potentially set stale state. The loadDocument effect checks token too.
    }
  }, [docId, token]);

  // Auto-backup to localStorage every 30 seconds
  // Uses refs to avoid resetting the 30s interval on every keystroke
  useEffect(() => {
    if (!docId) return;
    const backupInterval = setInterval(() => {
      const currentElements = elementsRef.current;
      if (!currentElements || currentElements.length === 0) return;
      const backup = {
        docId,
        title: titleRef.current,
        elements: currentElements,
        timestamp: new Date().toISOString(),
        sceneSynopsis: sceneSynopsisRef.current,
        sceneStatus: sceneStatusRef.current,
        notes: notesRef.current,
        // Beat Board data
        beatCards: beatCardsRef.current,
        structureBeats: structureBeatsRef.current,
        whiteboardElements: whiteboardElementsRef.current,
      };
      localStorage.setItem(`rooms-backup-${docId}`, JSON.stringify(backup));
    }, 30000);
    return () => clearInterval(backupInterval);
  }, [docId]); // Only recreate when docId changes

  // Track last saved state for auto-save comparison
  const lastSavedElementsRef = useRef(null);
  const lastSavedTitleRef = useRef(null);
  const lastSavedBeatDataRef = useRef(null); // Track beat board data changes
  const elementsRef = useRef(elements);
  const titleRef = useRef(title);
  const beatCardsRef = useRef(beatCards);
  const structureBeatsRef = useRef(structureBeats);
  const sceneSynopsisRef = useRef(sceneSynopsis);
  const sceneStatusRef = useRef(sceneStatus);
  const whiteboardElementsRef = useRef(whiteboardElements);
  const notesRef = useRef(notes);

  // Keep refs in sync
  useEffect(() => {
    elementsRef.current = elements;
  }, [elements]);
  
  useEffect(() => {
    titleRef.current = title;
  }, [title]);
  
  useEffect(() => {
    beatCardsRef.current = beatCards;
  }, [beatCards]);
  
  useEffect(() => {
    structureBeatsRef.current = structureBeats;
  }, [structureBeats]);
  
  useEffect(() => {
    sceneSynopsisRef.current = sceneSynopsis;
  }, [sceneSynopsis]);
  
  useEffect(() => {
    sceneStatusRef.current = sceneStatus;
  }, [sceneStatus]);
  
  useEffect(() => {
    whiteboardElementsRef.current = whiteboardElements;
  }, [whiteboardElements]);

  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  useEffect(() => {
    offlineDocIdRef.current = offlineDocId;
  }, [offlineDocId]);

  // Derived: fully connected = browser online + socket connected
  const isFullyConnected = isOnline && connected;

  // Browser online/offline detection
  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => { window.removeEventListener('online', goOnline); window.removeEventListener('offline', goOffline); };
  }, []);

  // Restore offline session from localStorage on mount
  useEffect(() => {
    if (!docId) return;
    const saved = localStorage.getItem(`rooms-offline-${docId}`);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.docId === docId && data.elements) {
          setOfflineDocId(docId);
          setOfflineSnapshot(data);
          setElements(data.elements);
          setTitle(data.title || 'SANS TITRE');
        }
      } catch (e) { console.error('[OFFLINE] Error restoring offline session:', e); }
    }
  }, [docId]);

  // Save offline copy to localStorage every 5 seconds when in offline mode
  useEffect(() => {
    if (!offlineDocId) return;
    const interval = setInterval(() => {
      const data = {
        docId: offlineDocId,
        title: titleRef.current,
        elements: elementsRef.current,
        timestamp: new Date().toISOString(),
        serverUpdatedAt: offlineSnapshot?.serverUpdatedAt || null,
      };
      localStorage.setItem(`rooms-offline-${offlineDocId}`, JSON.stringify(data));
    }, 5000);
    return () => clearInterval(interval);
  }, [offlineDocId, offlineSnapshot]);

  // Activate offline mode
  const activateOfflineMode = useCallback(() => {
    const snapshot = {
      docId, title: titleRef.current, elements: elementsRef.current,
      timestamp: new Date().toISOString(),
      serverUpdatedAt: lastSaved ? lastSaved.toISOString() : new Date().toISOString(),
    };
    localStorage.setItem(`rooms-offline-${docId}`, JSON.stringify(snapshot));
    setOfflineSnapshot(snapshot);
    setOfflineDocId(docId);
  }, [docId, lastSaved]);

  // Push offline changes to server
  const pushOfflineChanges = useCallback(async (force = false) => {
    if (!offlineDocId || !token) return;
    try {
      // Check server state first
      const metaRes = await fetch(SERVER_URL + '/api/documents/' + offlineDocId + '/meta', {
        headers: { Authorization: 'Bearer ' + token },
      });
      if (!metaRes.ok) throw new Error('Failed to fetch document meta');
      const meta = await metaRes.json();

      // Compare timestamps to detect conflict
      const snapshotTime = offlineSnapshot?.serverUpdatedAt ? new Date(offlineSnapshot.serverUpdatedAt).getTime() : 0;
      const serverTime = new Date(meta.updatedAt).getTime();
      const hasConflict = serverTime > snapshotTime + 5000; // 5s tolerance

      if (hasConflict && !force) {
        setConflictServerUpdatedAt(meta.updatedAt);
        setShowConflictModal(true);
        return;
      }

      // Push changes via autosave endpoint
      const res = await fetch(SERVER_URL + '/api/documents/' + offlineDocId + '/autosave', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ title: titleRef.current, elements: elementsRef.current }),
      });
      if (!res.ok) throw new Error('Push failed');

      // Notify other connected users via full-sync
      if (socketRef.current && connected) {
        socketRef.current.emit('full-sync', { elements: elementsRef.current });
      }

      // Cleanup offline state
      localStorage.removeItem(`rooms-offline-${offlineDocId}`);
      setOfflineDocId(null);
      setOfflineSnapshot(null);
      setShowConflictModal(false);
      setLastSaved(new Date());
      console.log('[OFFLINE] Changes pushed successfully');
    } catch (err) {
      console.error('[OFFLINE] Push error:', err);
    }
  }, [offlineDocId, offlineSnapshot, token, connected]);

  // Discard offline copy
  const discardOfflineCopy = useCallback(() => {
    if (!offlineDocId) return;
    localStorage.removeItem(`rooms-offline-${offlineDocId}`);
    setOfflineDocId(null);
    setOfflineSnapshot(null);
    setShowConflictModal(false);
    // Force reload document from server
    loadedDocRef.current = null;
  }, [offlineDocId]);

  // Auto-save to cloud every 10 seconds (only if changes detected, skip in offline mode)
  useEffect(() => {
    if (!docId || !token || offlineDocId) return;

    const autoSaveInterval = setInterval(async () => {
      const currentElements = elementsRef.current;
      const currentTitle = titleRef.current;
      const currentBeatCards = beatCardsRef.current;
      const currentStructureBeats = structureBeatsRef.current;
      const currentSceneSynopsis = sceneSynopsisRef.current;
      const currentSceneStatus = sceneStatusRef.current;
      const currentWhiteboardElements = whiteboardElementsRef.current;
      
      if (!currentElements || currentElements.length === 0) return;
      // Don't autosave if document appears empty (only 1 element with no content)
      // This prevents overwriting real content after a failed load
      const hasRealContent = currentElements.length > 1 ||
        currentElements.some(el => el.content && stripHtml(el.content).trim().length > 0);
      if (!hasRealContent) return;

      // Build beat data object for comparison
      const currentBeatData = {
        beatCards: currentBeatCards,
        structureBeats: currentStructureBeats,
        sceneSynopsis: currentSceneSynopsis,
        sceneStatus: currentSceneStatus,
        whiteboardElements: currentWhiteboardElements
      };
      
      // Check if there are changes since last save
      const elementsChanged = JSON.stringify(currentElements) !== JSON.stringify(lastSavedElementsRef.current);
      const titleChanged = currentTitle !== lastSavedTitleRef.current;
      const beatDataChanged = JSON.stringify(currentBeatData) !== JSON.stringify(lastSavedBeatDataRef.current);
      
      if (elementsChanged || titleChanged || beatDataChanged) {
        try {
          const res = await fetch(SERVER_URL + '/api/documents/' + docId + '/autosave', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
            body: JSON.stringify({ 
              title: currentTitle, 
              elements: currentElements,
              // Beat Board data
              beatCards: currentBeatCards,
              structureBeats: currentStructureBeats,
              sceneSynopsis: currentSceneSynopsis,
              sceneStatus: currentSceneStatus,
              whiteboardElements: currentWhiteboardElements
            })
          });
          if (res.ok) {
            lastSavedElementsRef.current = JSON.parse(JSON.stringify(currentElements));
            lastSavedTitleRef.current = currentTitle;
            lastSavedBeatDataRef.current = JSON.parse(JSON.stringify(currentBeatData));
            setLastSaved(new Date());
            console.log('[AUTOSAVE] Saved at', new Date().toLocaleTimeString(), '(incl. Beat Board data)');
          } else {
            console.error('[AUTOSAVE] Server error:', res.status);
          }
        } catch (err) { 
          console.error('[AUTOSAVE] Error:', err); 
        }
      }
    }, 10000); // Every 10 seconds
    
    return () => clearInterval(autoSaveInterval);
  }, [docId, token, offlineDocId]); // Recreate when docId, token, or offline mode changes

  // Helper to format snapshot name: "TITLE - DD/MM/YY HH:MM" or "TITLE - DD/MM/YY HH:MM - AS" for autosave
  const formatSnapshotName = (docTitle, isAuto = false) => {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yy = String(now.getFullYear()).slice(-2);
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const suffix = isAuto ? ' - AS' : '';
    return `${docTitle || 'SANS TITRE'} - ${dd}/${mm}/${yy} ${hh}:${min}${suffix}`;
  };

  // Auto-snapshot every 15 minutes (only when document is open and has content)
  // Uses refs to avoid resetting the 15-min interval on every keystroke
  useEffect(() => {
    if (!docId || !token) return;

    const autoSnapshotInterval = setInterval(async () => {
      const currentElements = elementsRef.current;
      if (!currentElements || currentElements.length === 0) return;

      // Only create snapshot if document has meaningful content
      const hasContent = currentElements.some(el => el.content && stripHtml(el.content).trim().length > 0);
      if (!hasContent) return;

      try {
        const currentTitle = titleRef.current;
        const snapshotName = formatSnapshotName(currentTitle, true);
        const res = await fetch(SERVER_URL + '/api/documents/' + docId + '/snapshot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({
            title: currentTitle,
            elements: currentElements,
            auto: true,
            snapshotName,
            // Beat Board data
            beatCards: beatCardsRef.current,
            structureBeats: structureBeatsRef.current,
            sceneSynopsis: sceneSynopsisRef.current,
            sceneStatus: sceneStatusRef.current,
            whiteboardElements: whiteboardElementsRef.current
          })
        });
        if (res.ok) {
          console.log('[AUTO-SNAPSHOT] Created:', snapshotName);
        }
      } catch (err) {
        console.error('[AUTO-SNAPSHOT] Error:', err);
      }
    }, 15 * 60 * 1000); // 15 minutes

    return () => clearInterval(autoSnapshotInterval);
  }, [docId, token]); // Only recreate when docId or token changes

  // Track writing goals daily reset
  useEffect(() => {
    const today = new Date().toDateString();
    if (writingGoal.lastDate !== today) {
      setWritingGoal(prev => ({ ...prev, todayWords: 0, lastDate: today }));
    }
  }, [writingGoal.lastDate]);

  // Save writing goal to localStorage
  useEffect(() => {
    localStorage.setItem('rooms-writing-goal', JSON.stringify(writingGoal));
  }, [writingGoal]);

  // Stats calculation - deferred to avoid blocking Enter key
  const [stats, setStats] = useState({ words: 0, chars: 0, scenes: 0, dialogueWords: 0, actionWords: 0, dialogueRatio: 0, readingTimeMin: 0, screenTimeMin: 0 });
  const statsTimerRef = useRef(null);
  useEffect(() => {
    if (statsTimerRef.current) clearTimeout(statsTimerRef.current);
    statsTimerRef.current = setTimeout(() => {
      const allText = elementsRef.current.map(el => stripHtml(el.content)).join(' ');
      const words = allText.trim() ? allText.trim().split(/\s+/).length : 0;
      const chars = allText.length;
      const scenes = elementsRef.current.filter(el => el.type === 'scene').length;
      const dialogueWords = elementsRef.current
        .filter(el => el.type === 'dialogue')
        .map(el => stripHtml(el.content).trim().split(/\s+/).length)
        .reduce((a, b) => a + b, 0);
      const actionWords = elementsRef.current
        .filter(el => el.type === 'action')
        .map(el => stripHtml(el.content).trim().split(/\s+/).length)
        .reduce((a, b) => a + b, 0);
      const dialogueRatio = words > 0 ? Math.round((dialogueWords / words) * 100) : 0;
      const readingTimeMin = Math.ceil(words / 200);
      const screenTimeMin = Math.round(words / 150);
      setStats({ words, chars, scenes, dialogueWords, actionWords, dialogueRatio, readingTimeMin, screenTimeMin });
    }, 300);
    return () => { if (statsTimerRef.current) clearTimeout(statsTimerRef.current); };
  }, [elements]);

  // Track word count changes for writing goals
  const prevWordCountRef = useRef(0);
  useEffect(() => {
    if (stats.words > prevWordCountRef.current && prevWordCountRef.current > 0) {
      const wordsAdded = stats.words - prevWordCountRef.current;
      if (wordsAdded > 0 && wordsAdded < 100) { // Sanity check - ignore large jumps (like loading a doc)
        setWritingGoal(prev => ({ ...prev, todayWords: prev.todayWords + wordsAdded }));
      }
    }
    prevWordCountRef.current = stats.words;
  }, [stats.words]);

  // Load document via REST API
  useEffect(() => {
    const loadDocument = async () => {
      if (!docId || docId === 'local') {
        setElements([{ id: generateId(), type: 'scene', content: '' }]);
        setTitle('SANS TITRE');
        return;
      }
      if (loadedDocRef.current === docId) return;
      // Skip loading if no token — wait for user to login first
      // (the effect will re-trigger when token changes)
      if (!token) return;

      setLoading(true);
      try {
        const headers = { Authorization: 'Bearer ' + token };
        const res = await fetch(SERVER_URL + '/api/documents/' + docId, { headers });
        if (res.ok) {
          const data = await res.json();
          console.log('[LOAD] Document loaded with', data.elements?.length, 'elements');
          if (data.elements && data.elements.length > 0) {
            setTitle(data.title || 'SANS TITRE');
            setElements(data.elements);
            setCharacters(data.characters || []);
            setComments(data.comments || []);
            setSuggestions(data.suggestions || []);
            
            // Load Beat Board data from server if available
            if (data.beatCards) {
              console.log('[LOAD] Beat Board data found:', data.beatCards.length, 'cards');
              setBeatCards(data.beatCards);
            }
            if (data.structureBeats) {
              console.log('[LOAD] Structure beats found:', data.structureBeats.length, 'beats');
              setStructureBeats(data.structureBeats);
            }
            if (data.sceneSynopsis) {
              setSceneSynopsis(data.sceneSynopsis);
            }
            if (data.sceneStatus) {
              setSceneStatus(data.sceneStatus);
            }
            if (data.whiteboardElements) {
              console.log('[LOAD] Whiteboard elements found:', data.whiteboardElements.length, 'elements');
              setWhiteboardElements(data.whiteboardElements);
            }
            
            // If no Beat Board data from server, try local backup
            if (!data.beatCards && !data.structureBeats) {
              try {
                const backupStr = localStorage.getItem(`rooms-backup-${docId}`);
                if (backupStr) {
                  const backup = JSON.parse(backupStr);
                  if (backup.beatCards && backup.beatCards.length > 0) {
                    console.log('[LOAD] Restoring Beat Board from local backup:', backup.beatCards.length, 'cards');
                    setBeatCards(backup.beatCards);
                  }
                  if (backup.structureBeats && backup.structureBeats.length > 0) {
                    console.log('[LOAD] Restoring structure beats from local backup:', backup.structureBeats.length, 'beats');
                    setStructureBeats(backup.structureBeats);
                  }
                  if (backup.sceneSynopsis) {
                    setSceneSynopsis(backup.sceneSynopsis);
                  }
                  if (backup.sceneStatus) {
                    setSceneStatus(backup.sceneStatus);
                  }
                  if (backup.whiteboardElements && backup.whiteboardElements.length > 0) {
                    console.log('[LOAD] Restoring whiteboard from local backup:', backup.whiteboardElements.length, 'elements');
                    setWhiteboardElements(backup.whiteboardElements);
                  }
                }
              } catch (backupErr) {
                console.error('[LOAD] Error loading local backup:', backupErr);
              }
            }
            
            loadedDocRef.current = docId;
            setIsOwner(!!data.isOwner);
            if (data.publicAccess) setPublicAccessState(data.publicAccess);
            if (data.isOwner) setMyRole('editor');
            else if (data.publicAccess?.enabled) setMyRole(data.publicAccess.role || 'viewer');
            else setMyRole('viewer');
          }
        }
      } catch (err) { console.error('[LOAD] Error:', err); }
      // Small delay to let React render elements before hiding overlay
      setTimeout(() => setLoading(false), 100);
    };
    loadDocument();
  }, [docId, token]);

  // Socket connection (skip for local mode)
  useEffect(() => {
    if (docId === 'local') return; // Don't connect socket in local mode
    let isStale = false; // Guard against stale updates after cleanup

    const socket = io(SERVER_URL, { transports: ['websocket', 'polling'], auth: { token }, reconnectionAttempts: 10, timeout: 30000 });
    socketRef.current = socket;

    socket.on('connect', () => { if (isStale) return; setConnected(true); setMyId(socket.id); if (docId && docId !== 'local') socket.emit('join-document', { docId }); });
    socket.on('disconnect', () => { if (isStale) return; setConnected(false); });
    socket.on('document-state', data => {
      if (isStale) return;
      setUsers(data.users || []);
      if (data.role) setMyRole(data.role);
      if (data.suggestions) setSuggestions(data.suggestions);
      if (data.collaborators && data.collaborators.length > 0) {
        setCollaborators(data.collaborators);
      }
      // Always sync comments and suggestions regardless of offline mode
      if (data.comments) setComments(data.comments);
      // Re-sync document content on reconnect (only if NOT in offline mode)
      if (!offlineDocIdRef.current && data.elements) {
        setElements(data.elements);
        if (data.title) setTitle(data.title);
        console.log('[SYNC] Document re-synced from server on reconnect');
      }
    });
    // Listen for full-sync from other clients (undo/redo/drag)
    socket.on('full-sync-applied', ({ elements: newElements }) => {
      if (!isStale && !offlineDocIdRef.current) {
        setElements(newElements);
        console.log('[SYNC] Full sync received from another client');
      }
    });
    socket.on('title-updated', ({ title }) => { if (!isStale) setTitle(title); });
    socket.on('element-updated', ({ index, element }) => {
      if (isStale) return;
      setElements(p => {
        const u = [...p];
        // Match by element ID first (reliable), fallback to index
        const matchIdx = element?.id ? u.findIndex(el => el.id === element.id) : -1;
        const targetIdx = matchIdx >= 0 ? matchIdx : index;
        if (targetIdx >= 0 && targetIdx < u.length) u[targetIdx] = element;
        return u;
      });
    });
    socket.on('element-type-updated', ({ index, type, elementId }) => {
      if (isStale) return;
      setElements(p => {
        const u = [...p];
        // ID-based matching first, fallback to index
        const matchIdx = elementId ? u.findIndex(el => el.id === elementId) : -1;
        const targetIdx = matchIdx >= 0 ? matchIdx : index;
        if (targetIdx >= 0 && targetIdx < u.length) u[targetIdx] = { ...u[targetIdx], type };
        return u;
      });
    });
    socket.on('element-inserted', ({ afterIndex, afterElementId, element }) => {
      if (isStale) return;
      setElements(p => {
        const u = [...p];
        // ID-based positioning first, fallback to index
        const matchIdx = afterElementId ? u.findIndex(el => el.id === afterElementId) : -1;
        const insertAfter = matchIdx >= 0 ? matchIdx : afterIndex;
        u.splice(insertAfter + 1, 0, element);
        return u;
      });
    });
    socket.on('element-deleted', ({ index, elementId }) => {
      if (isStale) return;
      setElements(p => {
        // ID-based delete first, fallback to index
        if (elementId) return p.filter(el => el.id !== elementId);
        return p.filter((_, i) => i !== index);
      });
    });
    socket.on('user-joined', ({ users }) => { if (!isStale) setUsers(users); });
    socket.on('user-left', ({ users }) => { if (!isStale) setUsers(users); });
    socket.on('cursor-updated', ({ userId, cursor }) => { if (!isStale) setUsers(p => p.map(u => u.id === userId ? { ...u, cursor } : u)); });
    socket.on('document-restored', ({ title, elements }) => { if (!isStale) { setTitle(title); setElements(elements); } });
    socket.on('comment-added', ({ comment }) => { if (!isStale) setComments(p => [...p, comment]); });
    socket.on('comment-reply-added', ({ commentId, reply }) => { if (!isStale) setComments(p => p.map(c => (c.id === commentId || c._id === commentId) ? { ...c, replies: [...(c.replies || []), reply] } : c)); });
    socket.on('comment-resolved', ({ commentId, resolved }) => { if (!isStale) setComments(p => p.map(c => (c.id === commentId || c._id === commentId) ? { ...c, resolved } : c)); });
    socket.on('comment-deleted', ({ commentId }) => { if (!isStale) setComments(p => p.filter(c => c.id !== commentId && c._id !== commentId)); });
    socket.on('comment-updated', ({ commentId, content }) => { if (!isStale) setComments(p => p.map(c => (c.id === commentId || c._id === commentId) ? { ...c, content } : c)); });

    // Suggestion socket listeners
    socket.on('suggestion-added', ({ suggestion }) => { if (!isStale) setSuggestions(p => [...p, suggestion]); });
    socket.on('suggestion-accepted', ({ suggestionId }) => { if (!isStale) setSuggestions(p => p.filter(s => s.id !== suggestionId)); });
    socket.on('suggestion-rejected', ({ suggestionId }) => { if (!isStale) setSuggestions(p => p.filter(s => s.id !== suggestionId)); });

    // Chat messages
    socket.on('chat-message', (message) => {
      if (isStale) return;
      // Deduplicate - don't add if already exists
      setChatMessages(prev => {
        if (prev.some(m => m.id === message.id)) return prev;
        return [...prev, message];
      });
      // Increment unread if chat is closed and message is from someone else
      if (message.senderId !== socket.id) {
        setUnreadMessages(prev => prev + 1);
        playChatNotification();
      }
    });
    socket.on('chat-history', (messages) => { if (!isStale) setChatMessages(messages); });

    return () => { isStale = true; socket.disconnect(); };
  }, [docId, token, playChatNotification]);

  const handleLogin = (user, newToken) => {
    setCurrentUser(user);
    setToken(newToken);
    setShowAuthModal(false);
    // Always force document reload after login (new auth may grant different access)
    loadedDocRef.current = null;
    // Restore pending document if user opened a shared link before logging in
    if (pendingDocIdRef.current) {
      const pending = pendingDocIdRef.current;
      pendingDocIdRef.current = null;
      if (pending !== docId) {
        setDocId(pending);
      }
      window.location.hash = pending;
    }
  };
  const handleLogout = () => { 
    localStorage.removeItem('screenplay-token'); 
    localStorage.removeItem('screenplay-user'); 
    setCurrentUser(null); 
    setToken(null); 
    // Disconnect socket
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    // Return to landing page
    window.location.hash = '';
    window.location.reload();
  };

  // Send chat message
  const sendChatMessage = useCallback(() => {
    if (!chatInput.trim() || !socketRef.current || !connected || !docId) return;
    
    const message = {
      id: generateId(),
      senderId: myId,
      senderName: currentUser?.name || 'Anonyme',
      senderColor: users.find(u => u.id === myId)?.color || '#3b82f6',
      content: chatInput.trim(),
      timestamp: new Date().toISOString()
    };
    
    socketRef.current.emit('chat-message', { docId, message });
    setChatMessages(prev => [...prev, message]);
    setChatInput('');
  }, [chatInput, connected, docId, myId, currentUser, users]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (showChat && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, showChat]);

  // Clear unread when opening chat
  useEffect(() => {
    if (showChat) {
      setUnreadMessages(0);
    }
  }, [showChat]);

  // Save chat history to localStorage
  useEffect(() => {
    if (docId && chatMessages.length > 0) {
      localStorage.setItem(`rooms-chat-${docId}`, JSON.stringify(chatMessages.slice(-100))); // Keep last 100 messages
    }
  }, [chatMessages, docId]);

  // Load chat history from localStorage on mount
  useEffect(() => {
    if (docId) {
      const saved = localStorage.getItem(`rooms-chat-${docId}`);
      if (saved) {
        try {
          const messages = JSON.parse(saved);
          if (messages.length > 0 && chatMessages.length === 0) {
            setChatMessages(messages);
          }
        } catch (e) {}
      }
    }
  }, [docId]); // eslint-disable-line

  // Apply pending template after document loads
  useEffect(() => {
    const pendingTemplate = localStorage.getItem('pendingTemplate');
    if (pendingTemplate && socketRef.current && elements.length <= 2) {
      const template = SCRIPT_TEMPLATES[pendingTemplate];
      if (template) {
        // Clear the pending template
        localStorage.removeItem('pendingTemplate');
        
        // Apply template elements
        const templateElements = template.elements.map(el => ({
          id: 'el-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
          type: el.type,
          content: el.content
        }));
        
        setElements(templateElements);
        
        // Sync to server
        templateElements.forEach((el, idx) => {
          if (idx === 0) {
            socketRef.current.emit('element-change', { index: 0, element: el });
          } else {
            socketRef.current.emit('element-insert', { afterIndex: idx - 1, afterElementId: templateElements[idx - 1]?.id, element: el });
          }
        });
        
        // Set title based on template
        const newTitle = `Nouveau script - ${template.name}`;
        setTitle(newTitle);
        socketRef.current.emit('title-change', { title: newTitle });
      }
    }
  }, [elements.length]); // eslint-disable-line

  // Clear text selection and script focus when clicking elsewhere
  useEffect(() => {
    const handleClick = (e) => {
      // Clear text selection
      if (textSelection && !e.target.closest('.context-action-menu') && !e.target.closest('textarea')) {
        setTextSelection(null);
      }
      // Check if click is outside script area
      if (!e.target.closest('.script-page') && !e.target.closest('.context-action-menu') && !e.target.closest('.comments-sidebar')) {
        setScriptHasFocus(false);
      }
    };
    
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [textSelection]);

  // Drag handlers for floating panels
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDraggingChat) {
        e.preventDefault();
        setChatPosition({
          x: Math.max(0, Math.min(window.innerWidth - 320, e.clientX - dragOffsetRef.current.x)),
          y: Math.max(0, Math.min(window.innerHeight - 100, e.clientY - dragOffsetRef.current.y))
        });
      }
      if (isDraggingNote) {
        e.preventDefault();
        setNotePosition({
          x: Math.max(0, Math.min(window.innerWidth - 400, e.clientX - dragOffsetRef.current.x)),
          y: Math.max(0, Math.min(window.innerHeight - 100, e.clientY - dragOffsetRef.current.y))
        });
      }
      if (isDraggingTimer) {
        e.preventDefault();
        setTimerPosition({
          x: Math.max(0, Math.min(window.innerWidth - 240, e.clientX - dragOffsetRef.current.x)),
          y: Math.max(0, Math.min(window.innerHeight - 100, e.clientY - dragOffsetRef.current.y))
        });
      }
    };
    const handleMouseUp = () => {
      setIsDraggingChat(false);
      setIsDraggingNote(false);
      setIsDraggingTimer(false);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
    if (isDraggingChat || isDraggingNote || isDraggingTimer) {
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'grabbing';
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingChat, isDraggingNote, isDraggingTimer]);
  
  // Check if any panel is being dragged (for overlay)
  const isDraggingAny = isDraggingChat || isDraggingNote || isDraggingTimer;

  const createNewDocument = async (templateKey = null) => {
    if (!token) { setShowAuthModal(true); return; }
    try {
      const res = await fetch(SERVER_URL + '/api/documents', { method: 'POST', headers: { Authorization: 'Bearer ' + token } });
      const data = await res.json();
      loadedDocRef.current = null;
      
      // If template selected, store it for after the document loads
      if (templateKey && SCRIPT_TEMPLATES[templateKey]) {
        localStorage.setItem('pendingTemplate', templateKey);
      }
      
      window.location.hash = data.id;
      setShowDocsList(false);
      setShowTemplateModal(false);
    } catch (err) { console.error(err); }
  };

  const selectDocument = (id) => { loadedDocRef.current = null; window.location.hash = id; setShowDocsList(false); };

  // Group elements into pages - deferred to avoid blocking Enter key
  // Compute page break positions and page numbers for each element
  const computePageInfo = (els) => {
    const pageBreaks = new Set(); // Set of element indices that start a new page
    const pageNumbers = {}; // elementIndex -> page number
    let currentPage = 1;
    let h = 0;
    const getLines = el => {
      const l = el.content ? Math.ceil(stripHtml(el.content).length / 60) : 1;
      const e = { scene: 1.5, action: 1, character: 1, dialogue: 0, parenthetical: 0, transition: 1.5 };
      return l + (e[el.type] || 0);
    };
    const pageElements = []; // track elements in current page for orphan detection
    els.forEach((el, idx) => {
      const lines = getLines(el);
      if (h + lines > LINES_PER_PAGE && pageElements.length > 0) {
        let orphanCount = 0;
        const last = pageElements[pageElements.length - 1];
        if (last && last.type === 'scene') orphanCount = 1;
        else if (last && last.type === 'character') orphanCount = 1;
        else if (last && last.type === 'parenthetical' && pageElements.length >= 2 && pageElements[pageElements.length - 2]?.type === 'character') orphanCount = 2;
        // Move orphans to next page
        const orphanStartIdx = idx - orphanCount;
        currentPage++;
        const breakIdx = orphanCount > 0 ? orphanStartIdx : idx;
        pageBreaks.add(breakIdx);
        // Recalculate height for orphans
        h = 0;
        pageElements.length = 0;
        for (let i = breakIdx; i < idx; i++) {
          h += getLines(els[i]);
          pageElements.push(els[i]);
          pageNumbers[i] = currentPage;
        }
      }
      pageElements.push(el);
      pageNumbers[idx] = currentPage;
      h += lines;
    });
    return { pageBreaks, pageNumbers, totalPages: currentPage };
  };
  // V272: pageInfo supprimé (pagination gérée par le plugin ProseMirror dans SingleEditor)

  // Deferred: only used for autocomplete dropdown, not rendering
  const [extractedCharacters, setExtractedCharacters] = useState(() => { const c = new Set(characters); elements.forEach(el => { const t = stripHtml(el.content).trim(); if (el.type === 'character' && t) c.add(t.replace(/\s*\(.*?\)\s*/g, '').trim().toUpperCase()); }); return Array.from(c).sort(); });
  const extractedCharsTimerRef = useRef(null);
  useEffect(() => {
    if (extractedCharsTimerRef.current) clearTimeout(extractedCharsTimerRef.current);
    extractedCharsTimerRef.current = setTimeout(() => {
      const c = new Set(characters);
      elementsRef.current.forEach(el => { const t = stripHtml(el.content).trim(); if (el.type === 'character' && t) c.add(t.replace(/\s*\(.*?\)\s*/g, '').trim().toUpperCase()); });
      setExtractedCharacters(Array.from(c).sort());
    }, 300);
    return () => { if (extractedCharsTimerRef.current) clearTimeout(extractedCharsTimerRef.current); };
  }, [elements, characters]);
  const remoteCursors = useMemo(() => users.filter(u => u.id !== myId), [users, myId]);
  const canEdit = myRole === 'editor';
  const canEditNow = (isFullyConnected || !!offlineDocId) && canEdit;
  const canComment = myRole === 'editor' || myRole === 'commenter';

  // V272: lockedElementsMap supprimé (à réimplémenter dans SingleEditor)

  const totalComments = comments.filter(c => !c.resolved).length;

  // Outline - deferred to avoid blocking Enter key
  const [outline, setOutline] = useState([]);
  const outlineTimerRef = useRef(null);
  useEffect(() => {
    if (outlineTimerRef.current) clearTimeout(outlineTimerRef.current);
    outlineTimerRef.current = setTimeout(() => {
      const els = elementsRef.current;
      const scenes = [];
      let sceneNumber = 0;
      const sceneIndices = [];
      els.forEach((el, idx) => { if (el.type === 'scene') sceneIndices.push(idx); });
      els.forEach((el, idx) => {
        if (el.type === 'scene') {
          sceneNumber++;
          const sceneIdx = sceneIndices.indexOf(idx);
          const nextSceneIdx = sceneIndices[sceneIdx + 1] || els.length;
          let wordCount = 0;
          const sceneCharacters = new Set();
          for (let i = idx; i < nextSceneIdx; i++) {
            const content = stripHtml(els[i]?.content) || '';
            wordCount += content.trim().split(/\s+/).filter(w => w).length;
            if (els[i]?.type === 'character') sceneCharacters.add(content.toUpperCase());
          }
          scenes.push({ index: idx, number: sceneNumber, content: stripHtml(el.content) || '(sans titre)', id: el.id, wordCount, characters: [...sceneCharacters] });
        }
      });
      setOutline(scenes);
    }, 300);
    return () => { if (outlineTimerRef.current) clearTimeout(outlineTimerRef.current); };
  }, [elements]);

  // Filtered outline based on filters
  const filteredOutline = useMemo(() => {
    return outline.filter(scene => {
      // Filter by status
      if (outlineFilter.status && sceneStatus[scene.id] !== outlineFilter.status) return false;
      // Filter by assignee
      if (outlineFilter.assignee) {
        const assignment = sceneAssignments[scene.id];
        if (!assignment || assignment.userName !== outlineFilter.assignee) return false;
      }
      return true;
    });
  }, [outline, outlineFilter, sceneStatus, sceneAssignments]);

  // Find current scene based on activeIndex
  const currentSceneNumber = useMemo(() => {
    let lastScene = 0;
    for (let i = 0; i <= activeIndex; i++) {
      if (elements[i]?.type === 'scene') lastScene++;
    }
    return lastScene;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex]); // Only recalc when cursor moves, not on every keystroke

  // V272: sceneNumbersMap supprimé (numéros de scènes à réimplémenter via décorations ProseMirror)

  // Extract locations from scene headings
  // Locations and character stats - deferred to avoid blocking Enter key
  const [extractedLocations, setExtractedLocations] = useState([]);
  const [characterStats, setCharacterStats] = useState([]);
  const locsStatsTimerRef = useRef(null);
  useEffect(() => {
    if (locsStatsTimerRef.current) clearTimeout(locsStatsTimerRef.current);
    locsStatsTimerRef.current = setTimeout(() => {
      const els = elementsRef.current;
      // Locations
      const locs = new Set();
      els.forEach(el => {
        const t = stripHtml(el.content);
        if (el.type === 'scene' && t) {
          const match = t.match(/(?:INT\.|EXT\.|INT\/EXT\.?)\s*(.+?)(?:\s*-\s*(?:JOUR|NUIT|MATIN|SOIR|AUBE|CRÉPUSCULE|CONTINUOUS|LATER|SAME))?$/i);
          if (match && match[1]) locs.add(match[1].trim().toUpperCase());
        }
      });
      setExtractedLocations(Array.from(locs).sort());
      // Character stats
      const cStats = {};
      let currentScene = 0;
      els.forEach((el, idx) => {
        if (el.type === 'scene') currentScene++;
        if (el.type === 'character' && stripHtml(el.content).trim()) {
          const name = stripHtml(el.content).trim().replace(/\s*\(.*?\)\s*/g, '').trim().toUpperCase();
          if (!cStats[name]) cStats[name] = { name, lines: 0, firstAppearance: currentScene || 1, firstIndex: idx, scenes: new Set() };
          cStats[name].lines++;
          if (currentScene > 0) cStats[name].scenes.add(currentScene);
        }
      });
      Object.values(cStats).forEach(s => { s.sceneCount = s.scenes.size; delete s.scenes; });
      setCharacterStats(Object.values(cStats).sort((a, b) => b.lines - a.lines));
    }, 300);
    return () => { if (locsStatsTimerRef.current) clearTimeout(locsStatsTimerRef.current); };
  }, [elements]);

  // Search functionality
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const results = [];
    const query = searchQuery.toLowerCase();
    elements.forEach((el, idx) => {
      if (stripHtml(el.content).toLowerCase().includes(query)) {
        results.push({ index: idx, element: el });
      }
    });
    setSearchResults(results);
    setCurrentSearchIndex(0);
  }, [searchQuery, elements]);

  const goToSearchResult = (direction) => {
    if (searchResults.length === 0) return;
    let newIndex = currentSearchIndex + direction;
    if (newIndex < 0) newIndex = searchResults.length - 1;
    if (newIndex >= searchResults.length) newIndex = 0;
    setCurrentSearchIndex(newIndex);
    const result = searchResults[newIndex];
    setActiveIndex(result.index);
    setTimeout(() => {
      const elId = elementsRef.current[result.index]?.id;
      const el = elId ? document.querySelector(`[data-element-id="${elId}"]`) : null;
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  };

  const replaceOne = () => {
    if (searchResults.length === 0 || !replaceQuery) return;
    const result = searchResults[currentSearchIndex];
    const el = elements[result.index];
    // Replace in the plain text, then set as new content (formatting may be lost for replaced text)
    const plain = stripHtml(el.content);
    const newContent = plain.replace(new RegExp(searchQuery, 'i'), replaceQuery);
    updateElement(result.index, { ...el, content: newContent });
  };

  const replaceAll = () => {
    if (searchResults.length === 0 || !replaceQuery) return;
    const regex = new RegExp(searchQuery, 'gi');
    elements.forEach((el, idx) => {
      const plain = stripHtml(el.content);
      if (plain.toLowerCase().includes(searchQuery.toLowerCase())) {
        const newContent = plain.replace(regex, replaceQuery);
        updateElement(idx, { ...el, content: newContent });
      }
    });
    setSearchQuery('');
    setShowSearch(false);
  };

  // Navigate to scene from outline
  const navigateToScene = (index) => {
    setActiveIndex(index);
    setTimeout(() => {
      const elId = elementsRef.current[index]?.id;
      const el = elId ? document.querySelector(`[data-element-id="${elId}"]`) : null;
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  };

  // Navigate to scene by number
  const navigateToSceneByNumber = (sceneNumber) => {
    const sceneIndices = elements.map((el, i) => el.type === 'scene' ? i : -1).filter(i => i >= 0);
    if (sceneNumber >= 1 && sceneNumber <= sceneIndices.length) {
      navigateToScene(sceneIndices[sceneNumber - 1]);
    }
  };

  // Create snapshot manually (uses refs for stable callback)
  const createSnapshot = useCallback(async () => {
    if (!token || !docId) return;
    try {
      const curTitle = titleRef.current;
      const snapshotName = formatSnapshotName(curTitle, false);
      const res = await fetch(SERVER_URL + '/api/documents/' + docId + '/snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({
          title: curTitle,
          elements: elementsRef.current,
          auto: false,
          snapshotName,
          // Beat Board data
          beatCards: beatCardsRef.current,
          structureBeats: structureBeatsRef.current,
          sceneSynopsis: sceneSynopsisRef.current,
          sceneStatus: sceneStatusRef.current,
          whiteboardElements: whiteboardElementsRef.current
        })
      });
      if (res.ok) {
        console.log('[SNAPSHOT] Created:', snapshotName, '(incl. Beat Board data)');
        setLastSaved(new Date());
        // Brief visual feedback
        const btn = document.querySelector('[title="Snapshot (⌘S)"]');
        if (btn) {
          btn.style.background = '#059669';
          setTimeout(() => { btn.style.background = 'transparent'; }, 500);
        }
      }
    } catch (err) { console.error(err); }
  }, [token, docId]);

  // Close dropdown menus when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setShowToolsMenu(false);
      setShowDocMenu(false);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Writing timer - supports both chrono (count up) and sprint (countdown) modes
  useEffect(() => {
    let interval;
    if (timerRunning) {
      interval = setInterval(() => {
        if (timerMode === 'chrono') {
          setTimerSeconds(s => s + 1);
        } else {
          // Sprint mode - countdown
          setSprintTimeLeft(t => {
            if (t <= 1) {
              // Sprint finished!
              setTimerRunning(false);
              // Play sound notification
              try {
                const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleB8LZKzW8NJ2KQ5TiMD6zYI+E0R1sbznl0gaMmKe0eOmWyAbJ0+Ax+e+fD8kXqLk9Nhnf0lVhKSsloFzYGJ6mamgejEgI0RtiJuTfl9OUUZ9oL62p4JlPUBakL7NoIVpKnuq1c2RUy4qXIvG7MB3QiQ4WpTK76tiOipGe6/e2aFXMSVCcKPk7MJqPSZAX5XX8NN9QwkqXJjH3pd5MChLkdT+wpqBVzI0');
                audio.play().catch(() => {});
              } catch (e) {}
              // Show alert
              alert('🎉 Sprint terminé ! Bravo !');
              return sprintDuration; // Reset for next sprint
            }
            return t - 1;
          });
          setTimerSeconds(s => s + 1); // Still track total time
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerRunning, timerMode, sprintDuration]);

  // Track session word count
  useEffect(() => {
    if (timerRunning && sessionStartWords === 0) {
      setSessionStartWords(stats.words);
    }
    if (timerRunning) {
      setSessionWordCount(Math.max(0, stats.words - sessionStartWords));
    }
  }, [stats.words, timerRunning, sessionStartWords]);

  const resetTimer = () => {
    setTimerSeconds(0);
    setTimerRunning(false);
    setSessionWordCount(0);
    setSessionStartWords(0);
    setSprintTimeLeft(sprintDuration);
  };

  // Change sprint duration
  const setSprintMinutes = (minutes) => {
    const seconds = minutes * 60;
    setSprintDuration(seconds);
    setSprintTimeLeft(seconds);
  };

  // Detect Safari browser for performance optimizations
  const isSafari = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  }, []);

  // Track element positions for comments sync (Google Docs style)
  // On Safari, update much less frequently to avoid jank
  const positionsUpdateTimeoutRef = useRef(null);
  useEffect(() => {
    if (!showComments) return;
    
    // Collect element positions - only update when needed
    const updatePositions = () => {
      if (positionsUpdateTimeoutRef.current) return; // Throttle
      
      positionsUpdateTimeoutRef.current = setTimeout(() => {
        positionsUpdateTimeoutRef.current = null;
        requestAnimationFrame(() => {
          const positions = {};
          const elementDivs = document.querySelectorAll('[data-element-id]');
          elementDivs.forEach(div => {
            const elId = div.getAttribute('data-element-id');
            const index = elementsRef.current.findIndex(e => e.id === elId);
            if (index !== -1) {
              const rect = div.getBoundingClientRect();
              const containerRect = scriptContainerRef.current?.getBoundingClientRect();
              const containerScrollTop = scriptContainerRef.current?.scrollTop || 0;
              if (containerRect) {
                positions[index] = rect.top - containerRect.top + containerScrollTop;
              } else {
                positions[index] = rect.top + window.scrollY - 60;
              }
            }
          });
          setElementPositions(positions);
        });
      }, isSafari ? 500 : 100); // Much longer throttle on Safari
    };
    
    // Initial update (delayed on Safari)
    setTimeout(updatePositions, isSafari ? 300 : 0);
    
    // Update on resize (heavily throttled)
    let resizeTimeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(updatePositions, isSafari ? 500 : 100);
    };
    window.addEventListener('resize', handleResize);
    
    // Update positions very infrequently on Safari
    const positionInterval = setInterval(updatePositions, isSafari ? 5000 : 2000);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      clearInterval(positionInterval);
      clearTimeout(resizeTimeout);
      if (positionsUpdateTimeoutRef.current) {
        clearTimeout(positionsUpdateTimeoutRef.current);
      }
    };
  }, [showComments, elements.length, isSafari]);

  // Pre-compute highlights per element (memoized for performance)
  const highlightsByElement = useMemo(() => {
    const map = {};
    
    // Process comments (supports multi-element spans)
    comments.forEach(c => {
      if (c.resolved) return;
      const commentId = String(c.id || c._id);
      if (c.spans && c.spans.length > 0) {
        // Multi-element comment: add a highlight entry for each spanned element
        c.spans.forEach(span => {
          if (!span.elementId) return;
          if (!map[span.elementId]) map[span.elementId] = [];
          map[span.elementId].push({
            startOffset: span.startOffset,
            endOffset: span.endOffset,
            type: 'comment',
            id: commentId,
            userColor: c.userColor
          });
        });
      } else if (c.elementId && c.highlight) {
        // Single-element comment (backward compat)
        if (!map[c.elementId]) map[c.elementId] = [];
        map[c.elementId].push({
          startOffset: c.highlight.startOffset,
          endOffset: c.highlight.endOffset,
          type: 'comment',
          id: commentId,
          userColor: c.userColor
        });
      }
    });
    
    // Process suggestions
    suggestions.forEach(s => {
      if (s.elementId && s.status === 'pending') {
        if (!map[s.elementId]) map[s.elementId] = [];
        map[s.elementId].push({
          startOffset: s.startOffset,
          endOffset: s.endOffset,
          type: 'suggestion',
          id: String(s.id || s._id),
          originalText: s.originalText,
          suggestedText: s.suggestedText,
          userColor: s.userColor
        });
      }
    });
    
    // Sort each element's highlights
    Object.keys(map).forEach(key => {
      map[key].sort((a, b) => a.startOffset - b.startOffset);
    });
    
    return map;
  }, [comments, suggestions]);

  // Get highlight data for an element (now just a lookup)
  // eslint-disable-next-line no-unused-vars
  const getElementHighlights = useCallback((elementId) => {
    return highlightsByElement[elementId] || [];
  }, [highlightsByElement]);

  // V272: CSS Highlight API replaced by TipTap marks (applied in SingleEditor)
  // Clean up any leftover CSS highlights
  useEffect(() => {
    if (typeof CSS !== 'undefined' && CSS.highlights) {
      CSS.highlights.delete('comment-highlight');
      CSS.highlights.delete('suggestion-highlight');
    }
  }, []);

  // Get initials from a name (e.g. "Jeremie Goldstein" -> "JG", "RomainV" -> "RV")
  // Render text content with highlighted comments (legacy fallback)
  // eslint-disable-next-line no-unused-vars
  const renderTextWithHighlights = (content, elementId) => {
    if (!content) return '';
    
    // Find all highlights for this element (comments)
    const elementHighlights = comments
      .filter(c => c.elementId === elementId && c.highlight && !c.resolved)
      .map(c => ({
        ...c.highlight,
        type: 'comment',
        commentId: c.id,
        userColor: c.userColor
      }));
    
    // Find all suggestions for this element
    const elementSuggestions = suggestions
      .filter(s => s.elementId === elementId && s.status === 'pending')
      .map(s => ({
        startOffset: s.startOffset,
        endOffset: s.endOffset,
        type: 'suggestion',
        suggestionId: s.id,
        originalText: s.originalText,
        suggestedText: s.suggestedText,
        userColor: s.userColor
      }));
    
    // Combine and sort by startOffset
    const allHighlights = [...elementHighlights, ...elementSuggestions]
      .sort((a, b) => a.startOffset - b.startOffset);
    
    if (allHighlights.length === 0) {
      return content;
    }
    
    // Build segments with highlights
    const segments = [];
    let lastIndex = 0;
    
    allHighlights.forEach((highlight) => {
      // Add text before this highlight
      if (highlight.startOffset > lastIndex) {
        segments.push({
          type: 'text',
          content: content.slice(lastIndex, highlight.startOffset)
        });
      }
      
      if (highlight.type === 'comment') {
        // Comment highlight
        segments.push({
          type: 'highlight',
          content: content.slice(highlight.startOffset, highlight.endOffset),
          commentId: highlight.commentId,
          userColor: highlight.userColor
        });
      } else if (highlight.type === 'suggestion') {
        // Suggestion: show original (strikethrough) + suggested (green)
        // Use stored originalText instead of slicing content (which may have changed)
        segments.push({
          type: 'suggestion',
          originalContent: highlight.originalText || content.slice(highlight.startOffset, highlight.endOffset),
          suggestedContent: highlight.suggestedText,
          suggestionId: highlight.suggestionId,
          userColor: highlight.userColor
        });
      }
      
      lastIndex = highlight.endOffset;
    });
    
    // Add remaining text
    if (lastIndex < content.length) {
      segments.push({
        type: 'text',
        content: content.slice(lastIndex)
      });
    }
    
    return segments.map((seg, idx) => {
      if (seg.type === 'highlight') {
        return (
          <span
            key={idx}
            data-comment-id={seg.commentId}
            style={{
              background: 'rgba(251, 191, 36, 0.4)',
              borderBottom: `2px solid ${seg.userColor || '#f59e0b'}`,
              cursor: 'text',
              borderRadius: 2,
              padding: '0 1px'
            }}
            title="Cliquer pour voir le commentaire"
          >
            {seg.content}
          </span>
        );
      }
      if (seg.type === 'suggestion') {
        return (
          <span key={idx} data-suggestion-id={seg.suggestionId} style={{ cursor: 'pointer' }}>
            <span
              style={{
                textDecoration: 'line-through',
                color: '#dc2626'
              }}
            >
              {seg.originalContent}
            </span>
            <span
              style={{
                color: '#16a34a'
              }}
            >
              {seg.suggestedContent}
            </span>
          </span>
        );
      }
      return <span key={idx}>{seg.content}</span>;
    });
  };

  const getInitials = (name) => {
    if (!name) return '';
    const parts = name.trim().split(/[\s]+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    // Single word - take first 2 chars or first letter if uppercase detected
    const match = name.match(/[A-Z]/g);
    if (match && match.length >= 2) {
      return match.slice(0, 2).join('');
    }
    return name.slice(0, 2).toUpperCase();
  };

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const emitTitle = useCallback(t => { setTitle(t); if (socketRef.current && connected && canEdit) socketRef.current.emit('title-change', { title: t }); }, [connected, canEdit]);
  
  // Save to undo stack before changes - saves complete state snapshot
  // Uses refs to avoid recreating on every keystroke (prevents cascade re-renders)
  const pushToUndo = useCallback((snapshot = null) => {
    const currentSnapshot = snapshot || {
      elements: elementsRef.current,
      beatCards: beatCardsRef.current,
      structureBeats: structureBeatsRef.current,
      sceneSynopsis: sceneSynopsisRef.current,
      sceneStatus: sceneStatusRef.current
    };
    setUndoStack(prev => [...prev.slice(-30), currentSnapshot]); // Keep last 30
    setRedoStack([]); // Clear redo on new action
  }, []); // Stable — reads from refs

  const undo = useCallback(() => {
    setUndoStack(prev => {
      if (prev.length === 0) return prev;
      const previous = prev[prev.length - 1];

      // Save current state to redo stack
      const currentSnapshot = {
        elements: elementsRef.current,
        beatCards: beatCardsRef.current,
        structureBeats: structureBeatsRef.current,
        sceneSynopsis: sceneSynopsisRef.current,
        sceneStatus: sceneStatusRef.current
      };
      setRedoStack(r => [...r, currentSnapshot]);

      // Restore previous state - handle both old format (just elements array) and new format (full snapshot)
      if (Array.isArray(previous)) {
        setElements(previous);
        if (socketRef.current) {
          socketRef.current.emit('full-sync', { elements: previous });
        }
      } else {
        if (previous.elements) setElements(previous.elements);
        if (previous.beatCards) setBeatCards(previous.beatCards);
        if (previous.structureBeats) setStructureBeats(previous.structureBeats);
        if (previous.sceneSynopsis) setSceneSynopsis(previous.sceneSynopsis);
        if (previous.sceneStatus) setSceneStatus(previous.sceneStatus);
        if (socketRef.current) {
          socketRef.current.emit('full-sync', { elements: previous.elements || elementsRef.current });
        }
      }

      return prev.slice(0, -1);
    });
  }, []); // Stable — reads from refs and uses functional updaters

  const redo = useCallback(() => {
    setRedoStack(prev => {
      if (prev.length === 0) return prev;
      const next = prev[prev.length - 1];

      // Save current state to undo stack
      const currentSnapshot = {
        elements: elementsRef.current,
        beatCards: beatCardsRef.current,
        structureBeats: structureBeatsRef.current,
        sceneSynopsis: sceneSynopsisRef.current,
        sceneStatus: sceneStatusRef.current
      };
      setUndoStack(u => [...u, currentSnapshot]);

      // Restore next state - handle both old format and new format
      if (Array.isArray(next)) {
        setElements(next);
        if (socketRef.current) {
          socketRef.current.emit('full-sync', { elements: next });
        }
      } else {
        if (next.elements) setElements(next.elements);
        if (next.beatCards) setBeatCards(next.beatCards);
        if (next.structureBeats) setStructureBeats(next.structureBeats);
        if (next.sceneSynopsis) setSceneSynopsis(next.sceneSynopsis);
        if (next.sceneStatus) setSceneStatus(next.sceneStatus);
        if (socketRef.current) {
          socketRef.current.emit('full-sync', { elements: next.elements || elementsRef.current });
        }
      }

      return prev.slice(0, -1);
    });
  }, []); // Stable — reads from refs and uses functional updaters

  // Duplicate scene function (moved here for proper hoisting)
  const duplicateScene = useCallback((sceneIndex) => {
    pushToUndo();
    const sceneIndices = elements.map((el, i) => el.type === 'scene' ? i : -1).filter(i => i >= 0);
    const currentScenePos = sceneIndices.indexOf(sceneIndex);
    const nextSceneIndex = currentScenePos < sceneIndices.length - 1 ? sceneIndices[currentScenePos + 1] : elements.length;
    
    // Get all elements in this scene
    const sceneElements = elements.slice(sceneIndex, nextSceneIndex).map(el => ({
      ...el,
      id: generateId()
    }));
    
    // Insert after the scene
    const newElements = [
      ...elements.slice(0, nextSceneIndex),
      ...sceneElements,
      ...elements.slice(nextSceneIndex)
    ];
    
    setElements(newElements);
    setLastSaved(new Date());
    
    if (socketRef.current && connected && canEdit) {
      socketRef.current.emit('full-sync', { elements: newElements });
    }
  }, [elements, connected, canEdit, pushToUndo]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      // Check if focus is inside a text input (editor, textarea, input)
      const activeEl = document.activeElement;
      const isInEditor = activeEl && (
        activeEl.isContentEditable ||
        activeEl.closest('[contenteditable="true"]') ||
        activeEl.closest('.ProseMirror')
      );
      const isInTextInput = activeEl && (
        activeEl.tagName === 'INPUT' ||
        activeEl.tagName === 'TEXTAREA'
      );

      // When inside any text input (comment, search, etc.), let ALL keys pass through natively
      if (isInTextInput) {
        // Only intercept Cmd+S (snapshot) — everything else goes to the input
        if (!((e.metaKey || e.ctrlKey) && e.key === 's')) return;
      }

      // When inside an editor, let standard text editing shortcuts pass through to TipTap
      if (isInEditor && (e.metaKey || e.ctrlKey)) {
        const k = e.key.toLowerCase();
        // Bold, Italic, Underline, Undo, Redo — let TipTap handle these
        if (k === 'b' || k === 'i' || k === 'u' || k === 'z') return;
      }

      // Cmd+S = Snapshot
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        createSnapshot();
      }
      // Cmd+F = Search
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        setShowSearch(true);
      }
      // Cmd+O = Outline (prevent default open file dialog)
      if ((e.metaKey || e.ctrlKey) && e.key === 'o') {
        e.preventDefault();
        setShowOutline(prev => !prev);
      }
      // Cmd+N = Add note to current element (prevent default new window)
      if ((e.metaKey || e.ctrlKey) && e.key === 'n' && docId) {
        e.preventDefault();
        setShowNoteFor(elements[activeIndex]?.id);
      }
      // Cmd+? or Cmd+/ = Show shortcuts
      if ((e.metaKey || e.ctrlKey) && (e.key === '?' || e.key === '/')) {
        e.preventDefault();
        setShowShortcuts(prev => !prev);
      }
      // Cmd+. = Focus mode
      if ((e.metaKey || e.ctrlKey) && e.key === '.') {
        e.preventDefault();
        setFocusMode(prev => !prev);
      }
      // Cmd+Z = Undo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      // Cmd+Shift+Z = Redo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        redo();
      }
      // Cmd+G = Go to scene
      if ((e.metaKey || e.ctrlKey) && e.key === 'g') {
        e.preventDefault();
        setShowGoToScene(true);
      }
      // Cmd+D = Duplicate current scene
      if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        e.preventDefault();
        // Find the current scene (look backward from activeIndex for a scene element)
        let sceneIdx = activeIndex;
        while (sceneIdx >= 0 && elements[sceneIdx]?.type !== 'scene') {
          sceneIdx--;
        }
        if (sceneIdx >= 0) {
          duplicateScene(sceneIdx);
        }
      }
      // Cmd+B = Toggle Beat Board view
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        setActiveView(v => v === 'script' ? 'beatboard' : 'script');
      }
      // B alone = Open Beat Board (only if not in input/textarea)
      if (e.key === 'b' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const activeEl = document.activeElement;
        const isInInput = activeEl && (
          activeEl.tagName === 'INPUT' || 
          activeEl.tagName === 'TEXTAREA' || 
          activeEl.isContentEditable ||
          activeEl.closest('[contenteditable="true"]')
        );
        if (!isInInput && activeView === 'script') {
          e.preventDefault();
          setActiveView('beatboard');
        }
      }
      // Escape = Close panels (one at a time) - Beat Board first
      if (e.key === 'Escape') {
        // Beat Board has priority - close it first
        if (activeView === 'beatboard') { setActiveView('script'); return; }
        if (showGoToScene) { setShowGoToScene(false); return; }
        if (showShortcuts) { setShowShortcuts(false); return; }
        if (showRenameChar) { setShowRenameChar(false); return; }
        if (showNoteFor) { setShowNoteFor(null); return; }
        if (showSearch) { setShowSearch(false); return; }
        if (showCharactersPanel) { setShowCharactersPanel(false); return; }
        if (showOutline) setShowOutline(false);
      }
    };
    // Use capture phase to ensure we get the event before TipTap/ProseMirror
    window.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown, true);
  }, [showSearch, showOutline, showNoteFor, showCharactersPanel, showShortcuts, showRenameChar, showGoToScene, token, docId, title, elements, activeIndex, undo, redo, duplicateScene, activeView, createSnapshot]);

  // Typewriter sound effect - placeholder for custom audio files
  // To add real typewriter sounds, place audio files in public folder and update URLs below
  const typewriterAudioRef = useRef({
    key: null,
    enter: null,
    backspace: null,
    initialized: false
  });
  
  const playTypewriterSound = useCallback((type = 'key') => {
    if (!typewriterSound) return;
    
    // Initialize audio elements on first use
    if (!typewriterAudioRef.current.initialized) {
      typewriterAudioRef.current = {
        initialized: true,
        // Replace these URLs with your own typewriter sound files:
        // key: new Audio('/sounds/typewriter-key.mp3'),
        // enter: new Audio('/sounds/typewriter-return.mp3'),
        // backspace: new Audio('/sounds/typewriter-backspace.mp3'),
        key: null,
        enter: null,
        backspace: null
      };
    }
    
    const audio = typewriterAudioRef.current;
    try {
      if (type === 'enter' && audio.enter) {
        audio.enter.currentTime = 0;
        audio.enter.volume = 0.4;
        audio.enter.play().catch(() => {});
      } else if (type === 'backspace' && audio.backspace) {
        audio.backspace.currentTime = 0;
        audio.backspace.volume = 0.3;
        audio.backspace.play().catch(() => {});
      } else if (audio.key) {
        audio.key.currentTime = 0;
        audio.key.volume = 0.3;
        audio.key.play().catch(() => {});
      }
    } catch (e) {}
  }, [typewriterSound]);

  // Typewriter sound on keypress
  useEffect(() => {
    if (!typewriterSound) return;
    const handleKeyPress = (e) => {
      // Different sounds for different keys
      if (e.key === 'Enter') {
        playTypewriterSound('enter');
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        playTypewriterSound('backspace');
      } else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
        playTypewriterSound('key');
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [typewriterSound, playTypewriterSound]);

  const updateElement = useCallback((i, el, skipUndo = false) => {
    if (!canEditNow) return;
    if (!skipUndo) pushToUndo();
    setElements(p => { const u = [...p]; u[i] = el; return u; });
    if (socketRef.current && connected && canEdit && !offlineDocIdRef.current) socketRef.current.emit('element-change', { index: i, element: el });
    setLastSaved(new Date());
    setLastModifiedBy({ userName: currentUser?.name || 'Vous', timestamp: new Date() });
  }, [connected, canEdit, canEditNow, pushToUndo, currentUser]);
  const insertElement = useCallback((after, type) => {
    if (!canEditNow) return;
    pushToUndo();
    const el = { id: generateId(), type, content: '' };
    setElements(p => { const u = [...p]; u.splice(after + 1, 0, el); return u; });
    setActiveIndex(after + 1);
    const afterElementId = elementsRef.current[after]?.id;
    if (socketRef.current && connected && canEdit && !offlineDocIdRef.current) socketRef.current.emit('element-insert', { afterIndex: after, afterElementId, element: el });
    setLastSaved(new Date());
  }, [connected, canEdit, canEditNow, pushToUndo]);
  // eslint-disable-next-line no-unused-vars
  const deleteElement = useCallback(i => {
    if (!canEditNow) return;
    if (elementsRef.current.length === 1) return;
    pushToUndo();
    const elementId = elementsRef.current[i]?.id;
    setElements(p => p.filter((_, idx) => idx !== i));
    setActiveIndex(Math.max(0, i - 1));
    if (socketRef.current && connected && canEdit && !offlineDocIdRef.current) socketRef.current.emit('element-delete', { index: i, elementId });
    setLastSaved(new Date());
  }, [connected, canEdit, canEditNow, pushToUndo]);
  const changeType = useCallback((i, t) => { if (!canEditNow) return; const elementId = elementsRef.current[i]?.id; setElements(p => { const u = [...p]; u[i] = { ...u[i], type: t }; return u; }); if (socketRef.current && connected && canEdit && !offlineDocIdRef.current) socketRef.current.emit('element-type-change', { index: i, type: t, elementId }); }, [connected, canEdit, canEditNow]);
  // V272: handleCursor supprimé (curseurs distants à réimplémenter via décorations ProseMirror)

  // V272: Single editor → elements change callback (replaces individual CRUD for typing)
  const fullSyncTimeoutRef = useRef(null);
  const handleElementsChange = useCallback((newElements) => {
    if (!newElements || newElements.length === 0) return;
    setElements(newElements);
    setLastSaved(new Date());
    setLastModifiedBy({ userName: currentUser?.name || 'Vous', timestamp: new Date() });
    // Debounced full-sync to server
    if (fullSyncTimeoutRef.current) clearTimeout(fullSyncTimeoutRef.current);
    fullSyncTimeoutRef.current = setTimeout(() => {
      if (socketRef.current && connected && canEdit && !offlineDocIdRef.current) {
        socketRef.current.emit('full-sync', { elements: elementsRef.current });
      }
    }, 500);
  }, [connected, canEdit, currentUser]);

  const handleSelectChar = useCallback((i, name) => { updateElement(i, { ...elements[i], content: name }); setTimeout(() => insertElement(i, 'dialogue'), 50); }, [elements, updateElement, insertElement]);
  
  const handleSelectLocation = useCallback((i, location) => {
    const el = elements[i];
    const plain = stripHtml(el.content);
    const match = plain.match(/^(INT\.|EXT\.|INT\/EXT\.?)\s*/i);
    const prefix = match ? match[1] + ' ' : '';
    updateElement(i, { ...el, content: prefix + location + ' - ' });
  }, [elements, updateElement]);

  // Rename character globally
  const renameCharacter = useCallback((fromName, toName) => {
    if (!fromName || !toName || fromName === toName) return;

    const newElements = elements.map(el => {
      if (el.type === 'character' && stripHtml(el.content).trim().toUpperCase() === fromName.toUpperCase()) {
        return { ...el, content: toName };
      }
      return el;
    });
    
    setElements(newElements);
    setShowRenameChar(false);
    
    // Emit changes for each modified element
    if (socketRef.current && connected && canEdit) {
      newElements.forEach((el, i) => {
        if (el !== elements[i]) {
          socketRef.current.emit('element-change', { index: i, element: el });
        }
      });
    }
  }, [elements, connected, canEdit]);

  // Move scene (drag & drop)
  // eslint-disable-next-line no-unused-vars
  const moveScene = useCallback((fromSceneIndex, toSceneIndex) => {
    if (fromSceneIndex === toSceneIndex) return;
    
    pushToUndo();
    
    // Find all scene start indices
    const sceneIndices = elements.map((el, i) => el.type === 'scene' ? i : -1).filter(i => i >= 0);
    
    const fromPos = sceneIndices.indexOf(fromSceneIndex);
    const toPos = sceneIndices.indexOf(toSceneIndex);
    
    if (fromPos === -1 || toPos === -1) return;
    
    // Get range of elements for the scene being moved
    const fromStart = fromSceneIndex;
    const fromEnd = fromPos < sceneIndices.length - 1 ? sceneIndices[fromPos + 1] : elements.length;
    const sceneElements = elements.slice(fromStart, fromEnd);
    
    // Remove the scene elements
    let newElements = [...elements.slice(0, fromStart), ...elements.slice(fromEnd)];
    
    // Recalculate insertion point
    const newSceneIndices = newElements.map((el, i) => el.type === 'scene' ? i : -1).filter(i => i >= 0);
    const adjustedToPos = toPos > fromPos ? toPos - 1 : toPos;
    const insertAt = adjustedToPos < newSceneIndices.length ? newSceneIndices[adjustedToPos] : newElements.length;
    
    // Insert at new position
    newElements = [...newElements.slice(0, insertAt), ...sceneElements, ...newElements.slice(insertAt)];
    
    setElements(newElements);
    setLastSaved(new Date());
    
    if (socketRef.current && connected && canEdit) {
      socketRef.current.emit('full-sync', { elements: newElements });
    }
  }, [elements, connected, canEdit, pushToUndo]);

  // Notes management
  const updateNote = useCallback((elementId, content, color = '#fef3c7') => {
    if (!content || !content.trim()) {
      setNotes(prev => { const n = { ...prev }; delete n[elementId]; return n; });
    } else {
      setNotes(prev => ({ ...prev, [elementId]: { content: content.trim(), color } }));
    }
    setShowNoteFor(null);
  }, []);

  const pushNoteToComment = async (elementId) => {
    const note = notes[elementId];
    if (!note || !token || !docId) return;
    try {
      await fetch(SERVER_URL + '/api/documents/' + docId + '/comments', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, 
        body: JSON.stringify({ elementId, content: '📝 ' + note.content }) 
      });
      // Remove the note after pushing
      setNotes(prev => { const n = { ...prev }; delete n[elementId]; return n; });
    } catch (err) { console.error(err); }
  };

  // V272: handleFocus supprimé (curseur géré par TipTap single editor)

  // V272: handleNoteClick supprimé (SceneLine legacy)
  
  const handleTextSelectCb = useCallback((selection) => {
    if (canComment) {
      setTextSelection(selection);
      if (selection && selection.rect) {
        setContextMenuTop(selection.rect.top);
      }
    }
  }, [canComment]);
  
  const handleHighlightClick = useCallback((commentId) => {
    setShowComments(true);
    setSelectedCommentId(commentId);
    setSelectedSuggestionId(null);
    setTimeout(() => {
      const commentCard = document.querySelector(`[data-comment-card-id="${commentId}"]`);
      if (commentCard) {
        commentCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 150);
  }, []);
  
  const handleSuggestionClickCb = useCallback((suggestionId) => {
    setShowComments(true);
    setSelectedSuggestionId(suggestionId);
    setSelectedCommentId(null);
    setTimeout(() => {
      const suggestionCard = document.querySelector(`[data-suggestion-card-id="${suggestionId}"]`);
      if (suggestionCard) {
        suggestionCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 150);
  }, []);

  // V272: handleKeyDown supprimé — keyboard shortcuts gérés nativement par ScreenplayElement node

  // ============ MULTI-BLOCK CLIPBOARD (global handler) ============
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (!selectedRange) return;
      const { start, end } = selectedRange;
      const isMeta = e.metaKey || e.ctrlKey;

      // Escape: clear selection
      if (e.key === 'Escape') {
        setSelectedRange(null);
        return;
      }

      // Don't intercept keys when focus is in an input/textarea (comment, search, etc.)
      const focusedEl = document.activeElement;
      if (focusedEl && (focusedEl.tagName === 'INPUT' || focusedEl.tagName === 'TEXTAREA' || (focusedEl.isContentEditable && !focusedEl.closest('.script-editor-container')))) {
        return;
      }

      // Cmd+C or Cmd+X: copy selected blocks to clipboard
      if (isMeta && (e.key === 'c' || e.key === 'x')) {
        e.preventDefault();
        e.stopPropagation();
        const selected = elementsRef.current.slice(start, end + 1);
        // Store blocks internally for reliable paste (avoids clipboard.read() permission issues)
        copiedBlocksRef.current = JSON.parse(JSON.stringify(selected));
        // Build formatted plain text for external paste (other apps)
        const plainText = selected.map(el => {
          const text = stripHtml(el.content) || '';
          switch (el.type) {
            case 'scene': return '\n' + text.toUpperCase() + '\n';
            case 'character': return '\n                         ' + text.toUpperCase();
            case 'parenthetical': return '                    ' + text;
            case 'dialogue': return '               ' + text;
            case 'transition': return '\n' + text.toUpperCase() + '\n';
            default: return '\n' + text;
          }
        }).join('\n').replace(/\n{3,}/g, '\n\n').trim();
        try {
          navigator.clipboard.writeText(plainText);
        } catch (err) {
          // silent fail
        }

        // If cut, also delete the selected elements
        if (e.key === 'x' && canEditNow) {
          pushToUndo();
          setElements(prev => {
            const newEls = prev.filter((_, i) => i < start || i > end);
            return newEls.length === 0 ? [{ id: generateId(), type: 'action', content: '' }] : newEls;
          });
          if (socketRef.current && connected && canEdit && !offlineDocIdRef.current) {
            setTimeout(() => { socketRef.current.emit('full-sync', { elements: elementsRef.current }); }, 100);
          }
          setActiveIndex(Math.min(start, elementsRef.current.length - 1));
          setSelectedRange(null);
        }
        return;
      }

      // Cmd+V: paste blocks
      if (isMeta && e.key === 'v' && canEditNow) {
        e.preventDefault();
        e.stopPropagation();

        const doInsert = (newBlocks) => {
          if (!newBlocks || newBlocks.length === 0) return;
          pushToUndo();
          setElements(prev => {
            const insertAt = end + 1;
            const newEls = [...prev];
            newEls.splice(insertAt, 0, ...newBlocks);
            return newEls;
          });
          setSelectedRange(null);
          setActiveIndex(end + 1);
          if (socketRef.current && connected && canEdit && !offlineDocIdRef.current) {
            setTimeout(() => { socketRef.current.emit('full-sync', { elements: elementsRef.current }); }, 100);
          }
        };

        // Priority 1: use internally copied blocks (preserves types perfectly)
        if (copiedBlocksRef.current) {
          const newBlocks = copiedBlocksRef.current.map(b => ({ ...b, id: generateId() }));
          doInsert(newBlocks);
          return;
        }

        // Priority 2: read plain text from clipboard (external paste)
        navigator.clipboard.readText().then(text => {
          if (!text) return;
          const lines = text.split('\n').filter(l => l.trim());
          const newBlocks = lines.map(line => ({ id: generateId(), type: 'action', content: line }));
          doInsert(newBlocks);
        }).catch(() => {});
        return;
      }

      // Backspace/Delete: delete selected blocks
      if ((e.key === 'Backspace' || e.key === 'Delete') && canEditNow) {
        e.preventDefault();
        e.stopPropagation();
        pushToUndo();
        setElements(prev => {
          const newEls = prev.filter((_, i) => i < start || i > end);
          return newEls.length === 0 ? [{ id: generateId(), type: 'action', content: '' }] : newEls;
        });
        if (socketRef.current && connected && canEdit && !offlineDocIdRef.current) {
          setTimeout(() => { socketRef.current.emit('full-sync', { elements: elementsRef.current }); }, 100);
        }
        setActiveIndex(Math.min(start, elementsRef.current.length - 1));
        setSelectedRange(null);
        return;
      }
    };

    if (selectedRange) {
      window.addEventListener('keydown', handleGlobalKeyDown, true); // capture phase
    }
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown, true);
    };
  }, [selectedRange, canEdit, canEditNow, connected, pushToUndo]);

  // ============ DRAG-SELECT across blocks ============
  useEffect(() => {
    const getElementIndexFromPoint = (x, y) => {
      // Walk up from elementFromPoint to find [data-element-id]
      const els = document.elementsFromPoint(x, y);
      for (const el of els) {
        const wrapper = el.closest('[data-element-id]');
        if (wrapper) {
          const elId = wrapper.getAttribute('data-element-id');
          return elementsRef.current.findIndex(e => e.id === elId);
        }
      }
      return null;
    };

    const handleMouseMove = (e) => {
      if (dragStartIndexRef.current === null) return;
      // Only start drag-select if mouse has moved enough (prevent accidental drags on normal clicks)
      if (!isDragSelecting) {
        // We need at least to move to a different block to start selection
        const hoverIdx = getElementIndexFromPoint(e.clientX, e.clientY);
        if (hoverIdx === null || hoverIdx === dragStartIndexRef.current) return;
        // Start drag selection
        setIsDragSelecting(true);
      }
      const hoverIdx = getElementIndexFromPoint(e.clientX, e.clientY);
      if (hoverIdx !== null && hoverIdx !== dragStartIndexRef.current) {
        const start = Math.min(dragStartIndexRef.current, hoverIdx);
        const end = Math.max(dragStartIndexRef.current, hoverIdx);
        setSelectedRange({ start, end });
        // Prevent text selection in individual editors while dragging
        e.preventDefault();
      }
    };

    const handleMouseUp = () => {
      if (isDragSelecting) {
        setIsDragSelecting(false);
      }
      dragStartIndexRef.current = null;
    };

    // Clear copiedBlocksRef when user does a normal copy (not multi-block)
    const handleNativeCopy = () => {
      if (!selectedRange) {
        copiedBlocksRef.current = null;
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('copy', handleNativeCopy);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('copy', handleNativeCopy);
    };
  }, [isDragSelecting, selectedRange]);

  // ============ IMPORT FDX - Creates new document ============
  const importFDX = () => {
    console.log('[IMPORT] importFDX called, token:', !!token);
    if (!token) { setShowAuthModal(true); return; }
    
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.fdx,.xml';
    input.style.display = 'none';
    document.body.appendChild(input);
    
    input.onchange = async (e) => {
      console.log('[IMPORT] File selected');
      const file = e.target.files?.[0];
      
      // Clean up input element
      document.body.removeChild(input);
      
      if (!file) {
        console.log('[IMPORT] No file selected');
        return;
      }
      
      setImporting(true);
      console.log('[IMPORT] Starting import of:', file.name);
    
      try {
        const text = await file.text();
        console.log('[IMPORT] File size:', text.length, 'chars');
        
        const parser = new DOMParser();
        const xml = parser.parseFromString(text, 'application/xml');
        
        // Check for parse errors
        const parseError = xml.querySelector('parsererror');
        if (parseError) {
          throw new Error('Fichier FDX invalide');
        }
        
        const paragraphs = xml.querySelectorAll('Paragraph');
        console.log('[IMPORT] Found', paragraphs.length, 'paragraphs');
        
        const newElements = [];
        paragraphs.forEach((p, i) => {
          const fdxType = p.getAttribute('Type');
          const type = FDX_TO_TYPE[fdxType] || 'action';
          
          // Get ALL Text nodes and concatenate them
          const textNodes = p.querySelectorAll('Text');
          let content = '';
          textNodes.forEach(t => { content += t.textContent || ''; });
          
          if (content.trim() || newElements.length === 0) {
            const id = generateId();
            newElements.push({ id, type, content: content.trim() });
          }
        });
        
        if (newElements.length === 0) {
          newElements.push({ id: generateId(), type: 'scene', content: '' });
        }
        
        // Get title from filename
        const fileName = file.name.replace(/\.fdx$/i, '').toUpperCase();
        
        console.log('[IMPORT] Creating document with', newElements.length, 'elements, title:', fileName);
        
        // Create document via API
        const res = await fetch(SERVER_URL + '/api/documents/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({ title: fileName, elements: newElements })
        });
        
        console.log('[IMPORT] Server response status:', res.status);
        
        if (res.ok) {
          const data = await res.json();
          console.log('[IMPORT] Document created:', data.id, 'with', data.elementsCount, 'elements');
          loadedDocRef.current = null;
          window.location.hash = data.id;
        } else if (res.status === 413) {
          alert('Erreur import: Fichier trop volumineux. Contactez l\'admin pour augmenter la limite serveur.');
        } else {
          try {
            const err = await res.json();
            console.error('[IMPORT] Server error:', err);
            alert('Erreur import: ' + (err.error || 'Erreur serveur'));
          } catch {
            alert('Erreur import: Erreur serveur ' + res.status);
          }
        }
      } catch (err) { 
        console.error('[IMPORT] Error:', err);
        alert('Erreur import: ' + err.message);
      }
      setImporting(false);
    };
    
    // Click must happen synchronously with user action
    input.click();
  };

  // ============ BULK SAVE (for existing doc) ============
  // eslint-disable-next-line no-unused-vars
  const bulkSave = async () => {
    if (!token || !docId) return;
    try {
      const res = await fetch(SERVER_URL + '/api/documents/' + docId + '/bulk', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ title, elements })
      });
      if (res.ok) {
        const data = await res.json();
        alert('Sauvegardé ! ' + data.elementsCount + ' éléments');
      }
    } catch (err) { console.error(err); }
  };

  // AI Rewrite function
  const handleAIRewrite = async (mode, customPrompt = '') => {
    if (!aiRewriteSelection) return;
    
    setAiRewriteLoading(true);
    setAiRewriteResult(null);
    
    const { text } = aiRewriteSelection;
    
    // Build the prompt based on mode
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
      setAiRewriteResult('❌ Erreur: ' + err.message);
    } finally {
      setAiRewriteLoading(false);
    }
  };
  
  // Apply AI rewrite to the element
  const applyAIRewrite = () => {
    if (!aiRewriteResult || !aiRewriteSelection) return;
    
    const { elementIndex, startOffset, endOffset } = aiRewriteSelection;
    const element = elements[elementIndex];
    if (!element) return;
    
    // Replace the selected portion with the AI result
    const plain = stripHtml(element.content);
    const before = plain.substring(0, startOffset);
    const after = plain.substring(endOffset);
    const newContent = before + aiRewriteResult + after;
    
    updateElement(elementIndex, newContent);
    
    // Close the modal
    setShowAIRewrite(false);
    setAiRewriteSelection(null);
    setAiRewriteResult(null);
    setAiRewriteMode(null);
  };

  const exportFDX = () => {
    const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<FinalDraft DocumentType="Script" Version="3">\n<Content>\n';
    elements.forEach(el => { xml += '<Paragraph Type="' + (TYPE_TO_FDX[el.type] || 'Action') + '"><Text>' + esc(stripHtml(el.content)) + '</Text></Paragraph>\n'; });
    xml += '</Content>\n</FinalDraft>';
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([xml], { type: 'application/xml' })); a.download = title.toLowerCase().replace(/\s+/g, '-') + '.fdx'; a.click();
  };

  const exportPDF = () => {
    const printWindow = window.open('', '_blank');
    const styles = `body { font-family: 'Courier Prime', 'Courier New', monospace; font-size: 12pt; line-height: 1; margin: 1in; } .scene { text-transform: uppercase; font-weight: bold; margin-top: 2em; } .action { margin-top: 1em; } .character { text-transform: uppercase; font-weight: bold; margin-left: 37%; margin-top: 1em; } .dialogue { margin-left: 17%; width: 42%; } .parenthetical { margin-left: 27%; font-style: italic; } .transition { text-transform: uppercase; text-align: right; margin-top: 1em; } @media print { @page { margin: 1in; } }`;
    let html = `<!DOCTYPE html><html><head><title>${title}</title><style>${styles}</style></head><body>`;
    elements.forEach(el => { html += `<p class="${el.type}">${el.content || '&nbsp;'}</p>`; }); // HTML content preserved for PDF
    html += '</body></html>';
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 500);
  };

  const exportFountain = () => {
    let fountain = `Title: ${title}\nCredit: written by\nAuthor: \nDraft date: ${new Date().toLocaleDateString('fr-FR')}\n\n`;
    
    elements.forEach(el => {
      const t = stripHtml(el.content);
      switch (el.type) {
        case 'scene':
          fountain += `\n${t.toUpperCase()}\n\n`;
          break;
        case 'action':
          fountain += `${t}\n\n`;
          break;
        case 'character':
          fountain += `${t.toUpperCase()}\n`;
          break;
        case 'dialogue':
          fountain += `${t}\n\n`;
          break;
        case 'parenthetical':
          fountain += `${t.startsWith('(') ? t : '(' + t + ')'}\n`;
          break;
        case 'transition':
          fountain += `\n> ${t.toUpperCase()}\n\n`;
          break;
        default:
          fountain += `${t}\n\n`;
      }
    });
    
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([fountain], { type: 'text/plain' }));
    a.download = title.toLowerCase().replace(/\s+/g, '-') + '.fountain';
    a.click();
  };

  const exportTXT = () => {
    let txt = `${title.toUpperCase()}\n${'='.repeat(title.length)}\n\n`;
    
    elements.forEach(el => {
      const t = stripHtml(el.content);
      switch (el.type) {
        case 'scene':
          txt += `\n${t.toUpperCase()}\n\n`;
          break;
        case 'action':
          txt += `${t}\n\n`;
          break;
        case 'character':
          txt += `\t\t\t${t.toUpperCase()}\n`;
          break;
        case 'dialogue':
          txt += `\t\t${t}\n\n`;
          break;
        case 'parenthetical':
          txt += `\t\t${t.startsWith('(') ? t : '(' + t + ')'}\n`;
          break;
        case 'transition':
          txt += `\n\t\t\t\t\t${t.toUpperCase()}\n\n`;
          break;
        default:
          txt += `${t}\n\n`;
      }
    });
    
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([txt], { type: 'text/plain' }));
    a.download = title.toLowerCase().replace(/\s+/g, '-') + '.txt';
    a.click();
  };

  const exportMarkdown = () => {
    let md = `# ${title}\n\n`;
    md += `*Exporté le ${new Date().toLocaleDateString('fr-FR')}*\n\n---\n\n`;
    
    let currentScene = 0;
    elements.forEach(el => {
      const t = stripHtml(el.content);
      switch (el.type) {
        case 'scene':
          currentScene++;
          md += `## Scène ${currentScene}: ${t}\n\n`;
          break;
        case 'action':
          md += `*${t}*\n\n`;
          break;
        case 'character':
          md += `**${t.toUpperCase()}**\n`;
          break;
        case 'dialogue':
          md += `> ${t}\n\n`;
          break;
        case 'parenthetical':
          md += `*(${t.replace(/[()]/g, '')})*\n`;
          break;
        case 'transition':
          md += `\n**${t.toUpperCase()}**\n\n---\n\n`;
          break;
        default:
          md += `${t}\n\n`;
      }
    });
    
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([md], { type: 'text/markdown' }));
    a.download = title.toLowerCase().replace(/\s+/g, '-') + '.md';
    a.click();
  };

  const [showShareModal, setShowShareModal] = useState(false);
  const [publicAccessState, setPublicAccessState] = useState({ enabled: false, role: 'editor' });
  const shareLink = window.location.origin + '/#' + docId;

  const openShareModal = async () => {
    setShowShareModal(true);
    // Auto-enable public access when sharing (owner only)
    if (isOwner && !publicAccessState.enabled) {
      try {
        const res = await fetch(SERVER_URL + '/api/documents/' + docId + '/public-access', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({ enabled: true, role: publicAccessState.role }),
        });
        if (res.ok) {
          const data = await res.json();
          setPublicAccessState(data.publicAccess);
        }
      } catch (err) { /* silent */ }
    }
  };

  const togglePublicAccess = async (enabled) => {
    try {
      const res = await fetch(SERVER_URL + '/api/documents/' + docId + '/public-access', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ enabled }),
      });
      if (res.ok) {
        const data = await res.json();
        setPublicAccessState(data.publicAccess);
      }
    } catch (err) { /* silent */ }
  };

  const changePublicRole = async (role) => {
    try {
      const res = await fetch(SERVER_URL + '/api/documents/' + docId + '/public-access', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ role }),
      });
      if (res.ok) {
        const data = await res.json();
        setPublicAccessState(data.publicAccess);
      }
    } catch (err) { /* silent */ }
  };

  const copyLink = () => { openShareModal(); };

  // ============ DESKTOP: bind menu handlers + sync title ============
  desktopMenuRef.current = { createNewDocument, createSnapshot, exportPDF, exportFDX, exportFountain, setShowDocsList };
  useEffect(() => {
    if (!IS_DESKTOP) return;
    const cleanup = window.electronAPI.onMenuAction((action) => {
      const h = desktopMenuRef.current;
      switch (action) {
        case 'new-document': h.createNewDocument?.(); break;
        case 'open-documents': h.setShowDocsList?.(true); break;
        case 'save-snapshot': h.createSnapshot?.(); break;
        case 'export-pdf': h.exportPDF?.(); break;
        case 'export-fdx': h.exportFDX?.(); break;
        case 'export-fountain': h.exportFountain?.(); break;
        default: break;
      }
    });
    return cleanup;
  }); // intentionally no deps — ref always has latest handlers
  // Sync window title
  useEffect(() => {
    if (IS_DESKTOP && title) window.electronAPI.setTitle(title);
  }, [title]);

  // Desktop: wait until port/user are ready before showing UI
  if (IS_DESKTOP && !desktopReady) {
    return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111827', color: 'white', fontSize: 18 }}>Chargement...</div>;
  }

  // Show landing page if not logged in (no token)
  if (!token && (!docId || docId === '' || docId === 'local')) {
    return (
      <div style={{ 
        height: '100vh', 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center', 
        justifyContent: 'center', 
        background: '#1a1a1a',
        color: 'white',
        position: 'relative'
      }}>
        {/* Language toggle */}
        <button
          onClick={() => setLanguage(language === 'fr' ? 'en' : 'fr')}
          style={{
            position: 'absolute',
            top: 20,
            right: 20,
            padding: '8px 12px',
            background: 'transparent',
            border: '1px solid #484848',
            borderRadius: 6,
            color: '#9ca3af',
            fontSize: 12,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
          {language === 'fr' ? '🇫🇷 FR' : '🇺🇸 EN'}
        </button>
        
        <div style={{ 
          textAlign: 'center',
          maxWidth: 400,
          padding: 40
        }}>
          {/* Logo centered */}
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
            <Logo darkMode={true} />
          </div>
          
          <p style={{ 
            fontSize: 14, 
            color: '#6b7280', 
            marginBottom: 48,
            lineHeight: 1.6
          }}>
            {t('tagline')}
          </p>
          
          {/* Connexion button */}
          <button 
            onClick={() => setShowAuthModal(true)}
            style={{ 
              width: '100%',
              padding: '16px 24px', 
              background: '#3b82f6', 
              border: 'none', 
              borderRadius: 10, 
              color: 'white', 
              fontSize: 16, 
              fontWeight: 600, 
              cursor: 'pointer',
              marginBottom: 12,
              transition: 'background 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#2563eb'}
            onMouseLeave={e => e.currentTarget.style.background = '#3b82f6'}
          >
            {t('login')}
          </button>
          
          {/* Continue without account */}
          <button 
            onClick={() => {
              // Set a flag to show editor without account
              setTitle(t('untitled'));
              window.location.hash = 'local';
            }}
            style={{ 
              width: '100%',
              padding: '14px 24px', 
              background: 'transparent', 
              border: '1px solid #484848', 
              borderRadius: 10, 
              color: '#9ca3af', 
              fontSize: 14, 
              cursor: 'pointer',
              transition: 'border-color 0.2s, color 0.2s'
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#6b7280'; e.currentTarget.style.color = 'white'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#484848'; e.currentTarget.style.color = '#9ca3af'; }}
          >
            {t('continueWithoutAccount')}
          </button>
          
          <p style={{ 
            marginTop: 32, 
            fontSize: 12, 
            color: '#6b7280' 
          }}>
            {t('noAccountWarning')}
          </p>
        </div>
        
        {showAuthModal && <AuthModal onLogin={handleLogin} onClose={() => setShowAuthModal(false)} t={t} />}
      </div>
    );
  }

  return (
    <div className={focusMode ? 'focus-mode-active' : ''} style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: darkMode ? '#2b2b2b' : '#e5e7eb', color: darkMode ? '#e5e7eb' : '#2b2b2b', transition: 'background 0.3s, color 0.3s', overflow: 'hidden' }}>
      {showAuthModal && <AuthModal onLogin={handleLogin} onClose={() => setShowAuthModal(false)} t={t} />}
      
      {/* Template Selector Modal */}
      {showTemplateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowTemplateModal(false)}>
          <div 
            style={{ 
              background: darkMode ? '#333333' : 'white', 
              borderRadius: 16, 
              width: '90%',
              maxWidth: 800,
              maxHeight: '85vh',
              overflow: 'hidden',
              boxShadow: '0 25px 50px rgba(0,0,0,0.5)'
            }} 
            onClick={e => e.stopPropagation()}
          >
            <div style={{ 
              padding: '20px 24px', 
              borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, color: darkMode ? 'white' : 'black', display: 'flex', alignItems: 'center', gap: 8 }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>Nouveau scénario</h2>
                <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#6b7280' }}>Choisissez une structure ou commencez de zéro</p>
              </div>
              <button onClick={() => setShowTemplateModal(false)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 20 }}>✕</button>
            </div>
            
            <div style={{ padding: 24, overflowY: 'auto', maxHeight: 'calc(85vh - 80px)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
                {Object.entries(SCRIPT_TEMPLATES).map(([key, template]) => (
                  <button
                    key={key}
                    onClick={() => createNewDocument(key)}
                    style={{
                      padding: 20,
                      background: darkMode ? '#484848' : '#f9fafb',
                      border: `2px solid ${darkMode ? '#555555' : '#e5e7eb'}`,
                      borderRadius: 12,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = '#3b82f6';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 8px 20px rgba(59, 130, 246, 0.2)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = darkMode ? '#555555' : '#e5e7eb';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div style={{ fontSize: 32, marginBottom: 12 }}>{template.icon}</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: darkMode ? 'white' : 'black', marginBottom: 6 }}>{template.name}</div>
                    <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.4 }}>{template.description}</div>
                    {key !== 'empty' && (
                      <div style={{ marginTop: 12, fontSize: 11, color: '#9ca3af' }}>
                        {template.elements.filter(e => e.type === 'scene' && stripHtml(e.content).startsWith('===')).length} sections
                      </div>
                    )}
                  </button>
                ))}
              </div>
              
              <div style={{ marginTop: 24, padding: 16, background: darkMode ? '#333333' : '#f3f4f6', borderRadius: 8, border: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}` }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: 13, color: darkMode ? 'white' : 'black' }}>💡 Conseil</h4>
                <p style={{ margin: 0, fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>
                  Les structures sont des guides, pas des règles absolues. Adaptez-les à votre histoire ! 
                  Les scènes marquées === sont des repères de structure que vous pouvez supprimer une fois votre plan établi.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      {showDocsList && token && <DocumentsList token={token} onSelectDoc={selectDocument} onCreateDoc={() => { setShowDocsList(false); setShowTemplateModal(true); }} onClose={() => setShowDocsList(false)} t={t} />}
      {showHistory && token && docId && <HistoryPanel docId={docId} token={token} currentTitle={title} onRestore={() => { loadedDocRef.current = null; window.location.reload(); }} onClose={() => setShowHistory(false)} t={t} />}
      
      {/* Search Panel */}
      {showSearch && (
        <div style={{ position: 'fixed', top: 70, left: showOutline ? 'calc(50% + 150px)' : '50%', transform: 'translateX(-50%)', background: darkMode ? '#333333' : 'white', borderRadius: 8, padding: 16, boxShadow: '0 10px 40px rgba(0,0,0,0.3)', zIndex: 200, display: 'flex', gap: 8, alignItems: 'center', transition: 'left 0.2s ease' }}>
          <input 
            autoFocus
            value={searchQuery} 
            onChange={e => setSearchQuery(e.target.value)} 
            placeholder="Rechercher..." 
            style={{ padding: '8px 12px', background: darkMode ? '#484848' : '#f3f4f6', border: 'none', borderRadius: 6, color: darkMode ? 'white' : 'black', fontSize: 14, width: 200 }}
            onKeyDown={e => { if (e.key === 'Enter') goToSearchResult(1); }}
          />
          <input 
            value={replaceQuery} 
            onChange={e => setReplaceQuery(e.target.value)} 
            placeholder="Remplacer..." 
            style={{ padding: '8px 12px', background: darkMode ? '#484848' : '#f3f4f6', border: 'none', borderRadius: 6, color: darkMode ? 'white' : 'black', fontSize: 14, width: 150 }}
          />
          <span style={{ color: darkMode ? '#9ca3af' : '#6b7280', fontSize: 12, minWidth: 50 }}>
            {searchResults.length > 0 ? `${currentSearchIndex + 1}/${searchResults.length}` : '0/0'}
          </span>
          <button onClick={() => goToSearchResult(-1)} style={{ padding: '6px 10px', background: darkMode ? '#484848' : '#e5e7eb', border: 'none', borderRadius: 4, color: darkMode ? 'white' : 'black', cursor: 'pointer' }}>▲</button>
          <button onClick={() => goToSearchResult(1)} style={{ padding: '6px 10px', background: darkMode ? '#484848' : '#e5e7eb', border: 'none', borderRadius: 4, color: darkMode ? 'white' : 'black', cursor: 'pointer' }}>▼</button>
          <button onClick={replaceOne} disabled={searchResults.length === 0} style={{ padding: '6px 10px', background: '#2563eb', border: 'none', borderRadius: 4, color: 'white', cursor: 'pointer', fontSize: 12 }}>Remplacer</button>
          <button onClick={replaceAll} disabled={searchResults.length === 0} style={{ padding: '6px 10px', background: '#7c3aed', border: 'none', borderRadius: 4, color: 'white', cursor: 'pointer', fontSize: 12 }}>Tout</button>
          <button onClick={() => setShowSearch(false)} style={{ padding: '6px 10px', background: 'transparent', border: 'none', color: darkMode ? '#9ca3af' : '#6b7280', cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>
      )}

      
      {/* HEADER - 3 zones: Left (menus), Center (doc info + collab), Right (quick toggles) */}
      <div style={{ position: 'sticky', top: 0, background: darkMode ? '#333333' : 'white', borderBottom: `1px solid ${darkMode ? '#484848' : '#d1d5db'}`, padding: '6px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 200, gap: 16 }}>
        
        {/* LEFT ZONE: Logo + Menus */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <Logo darkMode={darkMode} />
          
          {/* DOCUMENT MENU */}
          <div style={{ position: 'relative' }}>
            <button onClick={(e) => { e.stopPropagation(); setShowDocMenu(!showDocMenu); setShowToolsMenu(false); setShowImportSubmenu(false); setShowExportSubmenu(false); }} style={{ padding: '5px 10px', border: 'none', borderRadius: 6, background: showDocMenu ? (darkMode ? '#484848' : '#e5e7eb') : 'transparent', color: darkMode ? '#e5e7eb' : '#484848', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>
              {t('document')} ▾
            </button>
            {showDocMenu && (
              <div style={{ position: 'absolute', left: 0, top: '100%', marginTop: 4, background: darkMode ? '#333333' : 'white', border: `1px solid ${darkMode ? '#484848' : '#d1d5db'}`, borderRadius: 8, overflow: 'visible', minWidth: 200, zIndex: 500, boxShadow: '0 10px 25px rgba(0,0,0,0.3)' }}>
                <button onClick={() => { if (!token) { setShowAuthModal(true); } else { setShowTemplateModal(true); } setShowDocMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', borderRadius: '8px 8px 0 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
                  {t('new')}
                </button>
                {token && (
                  <button onClick={() => { setShowDocsList(true); setShowDocMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                    {t('myDocuments')}
                  </button>
                )}
                {docId && token && (
                  <>
                    <div style={{ height: 1, background: darkMode ? '#484848' : '#e5e7eb', margin: '4px 0' }} />
                    <button onClick={() => { createSnapshot(); setShowDocMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>{t('snapshot')}</span><span style={{ color: '#6b7280', fontSize: 10 }}>⌘S</span>
                    </button>
                    <button onClick={() => { setShowHistory(true); setShowDocMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      {t('history')}
                    </button>
                  </>
                )}
                
                <div style={{ height: 1, background: darkMode ? '#484848' : '#e5e7eb', margin: '4px 0' }} />
                
                {/* Import Submenu - Always available */}
                <div 
                  style={{ position: 'relative' }}
                  onMouseEnter={() => { setShowImportSubmenu(true); setShowExportSubmenu(false); }}
                  onMouseLeave={() => setShowImportSubmenu(false)}
                >
                  <button style={{ width: '100%', padding: '10px 14px', background: showImportSubmenu ? (darkMode ? '#484848' : '#f3f4f6') : 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>{t('import')}</span><span style={{ color: '#6b7280' }}>▸</span>
                  </button>
                  {showImportSubmenu && (
                    <div style={{ position: 'absolute', left: '100%', top: 0, marginLeft: 4, background: darkMode ? '#333333' : 'white', border: `1px solid ${darkMode ? '#484848' : '#d1d5db'}`, borderRadius: 8, overflow: 'hidden', minWidth: 160, zIndex: 501, boxShadow: '0 10px 25px rgba(0,0,0,0.3)' }}>
                      <button onClick={(e) => { e.stopPropagation(); importFDX(); setShowDocMenu(false); }} disabled={importing} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        FDX (Final Draft)
                      </button>
                    </div>
                  )}
                </div>
                
                {/* Export Submenu - Always available */}
                <div 
                  style={{ position: 'relative' }}
                  onMouseEnter={() => { setShowExportSubmenu(true); setShowImportSubmenu(false); }}
                  onMouseLeave={() => setShowExportSubmenu(false)}
                >
                  <button style={{ width: '100%', padding: '10px 14px', background: showExportSubmenu ? (darkMode ? '#484848' : '#f3f4f6') : 'transparent', border: 'none', color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '0 0 8px 8px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>{t('export')}</span><span style={{ color: '#6b7280' }}>▸</span>
                  </button>
                  {showExportSubmenu && (
                    <div style={{ position: 'absolute', left: '100%', top: 0, marginLeft: 4, background: darkMode ? '#333333' : 'white', border: `1px solid ${darkMode ? '#484848' : '#d1d5db'}`, borderRadius: 8, overflow: 'hidden', minWidth: 160, zIndex: 501, boxShadow: '0 10px 25px rgba(0,0,0,0.3)' }}>
                      <button onClick={() => { exportFDX(); setShowDocMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        FDX (Final Draft)
                      </button>
                      <button onClick={() => { exportFountain(); setShowDocMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2c2 4 4 6 4 10a4 4 0 1 1-8 0c0-4 2-6 4-10z"/></svg>
                        Fountain
                      </button>
                      <button onClick={() => { exportPDF(); setShowDocMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                        PDF
                      </button>
                      <button onClick={() => { exportTXT(); setShowDocMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                        TXT
                      </button>
                      <button onClick={() => { exportMarkdown(); setShowDocMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
                        Markdown
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          
          {/* TOOLS MENU */}
          <div style={{ position: 'relative' }}>
            <button onClick={(e) => { e.stopPropagation(); setShowToolsMenu(!showToolsMenu); setShowDocMenu(false); }} style={{ padding: '5px 10px', border: 'none', borderRadius: 6, background: showToolsMenu ? (darkMode ? '#484848' : '#e5e7eb') : 'transparent', color: darkMode ? '#e5e7eb' : '#484848', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>
              {t('tools')} ▾
            </button>
            {showToolsMenu && (
              <div style={{ position: 'absolute', left: 0, top: '100%', marginTop: 4, background: darkMode ? '#333333' : 'white', border: `1px solid ${darkMode ? '#484848' : '#d1d5db'}`, borderRadius: 8, overflow: 'visible', minWidth: 200, zIndex: 500, boxShadow: '0 10px 25px rgba(0,0,0,0.3)' }}>
                <button onClick={() => { setShowSearch(true); setShowToolsMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '8px 8px 0 0' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>{t('search')}</span><span style={{ color: '#6b7280', fontSize: 10 }}>⌘F</span>
                </button>
                <button onClick={() => { setShowRenameChar(true); setShowToolsMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                  {t('renameCharacter')}
                </button>
                <button onClick={() => { setShowCharactersPanel(!showCharactersPanel); setShowToolsMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: showCharactersPanel ? (darkMode ? '#484848' : '#f3f4f6') : 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  {t('characters')} {showCharactersPanel && '✓'}
                </button>
                <button onClick={() => { setShowStats(true); setShowToolsMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                  {t('statistics')}
                </button>
                <button onClick={() => { setShowGoToScene(true); setShowToolsMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>{t('goToScene')}</span><span style={{ color: '#6b7280', fontSize: 10 }}>⌘G</span>
                </button>
                <button onClick={() => { setShowSceneNumbers(!showSceneNumbers); setShowToolsMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: showSceneNumbers ? (darkMode ? '#484848' : '#f3f4f6') : 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>
                  {t('sceneNumbers')} {showSceneNumbers && '✓'}
                </button>
                {/* Font selector */}
                {Object.entries(FONT_OPTIONS).map(([key, { label }]) => (
                  <button key={key} onClick={() => { setScriptFont(key); localStorage.setItem('rooms-script-font', key); setShowToolsMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: scriptFont === key ? (darkMode ? '#484848' : '#f3f4f6') : 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>
                    {label} {scriptFont === key && '✓'}
                  </button>
                ))}
                <div style={{ height: 1, background: darkMode ? '#484848' : '#e5e7eb', margin: '4px 0' }} />
                <button onClick={() => { setChatNotificationSound(!chatNotificationSound); setShowToolsMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: chatNotificationSound ? (darkMode ? '#484848' : '#f3f4f6') : 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                  {t('chatNotifications')} {chatNotificationSound && '✓'}
                </button>
                
                {/* Language Submenu */}
                <div 
                  style={{ position: 'relative' }}
                  onMouseEnter={() => setShowLanguageSubmenu(true)}
                  onMouseLeave={() => setShowLanguageSubmenu(false)}
                >
                  <button style={{ width: '100%', padding: '10px 14px', background: showLanguageSubmenu ? (darkMode ? '#484848' : '#f3f4f6') : 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                      {t('language')}
                    </span>
                    <span style={{ color: '#6b7280' }}>▸</span>
                  </button>
                  {showLanguageSubmenu && (
                    <div style={{ position: 'absolute', left: '100%', top: 0, paddingLeft: 4, zIndex: 501 }}>
                      <div style={{ background: darkMode ? '#333333' : 'white', border: `1px solid ${darkMode ? '#484848' : '#d1d5db'}`, borderRadius: 8, overflow: 'hidden', minWidth: 140, boxShadow: '0 10px 25px rgba(0,0,0,0.3)' }}>
                        <button onClick={() => { setLanguage('fr'); setShowToolsMenu(false); setShowLanguageSubmenu(false); }} style={{ width: '100%', padding: '10px 14px', background: language === 'fr' ? (darkMode ? '#484848' : '#f3f4f6') : 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
                          🇫🇷 Français {language === 'fr' && '✓'}
                        </button>
                        <button onClick={() => { setLanguage('en'); setShowToolsMenu(false); setShowLanguageSubmenu(false); }} style={{ width: '100%', padding: '10px 14px', background: language === 'en' ? (darkMode ? '#484848' : '#f3f4f6') : 'transparent', border: 'none', color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
                          🇺🇸 English {language === 'en' && '✓'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                
                <button onClick={() => { setShowShortcuts(true); setShowToolsMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '0 0 8px 8px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" ry="2"/><path d="M6 8h.001"/><path d="M10 8h.001"/><path d="M14 8h.001"/><path d="M18 8h.001"/><path d="M8 12h.001"/><path d="M12 12h.001"/><path d="M16 12h.001"/><path d="M7 16h10"/></svg>{t('shortcuts')}</span><span style={{ color: '#6b7280', fontSize: 10 }}>⌘?</span>
                </button>
              </div>
            )}
          </div>
          
          {/* VIEW TABS - Script / Beat Board */}
          <div style={{ display: 'flex', marginLeft: 8, background: darkMode ? '#484848' : '#e5e7eb', borderRadius: 6, padding: 2 }}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setActiveView('script'); }}
              style={{
                padding: '5px 12px',
                border: 'none',
                borderRadius: 4,
                background: activeView === 'script' ? (darkMode ? '#333333' : 'white') : 'transparent',
                color: activeView === 'script' ? (darkMode ? 'white' : 'black') : '#6b7280',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                boxShadow: activeView === 'script' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
              Script
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setActiveView('beatboard'); }}
              style={{
                padding: '5px 12px',
                border: 'none',
                borderRadius: 4,
                background: activeView === 'beatboard' ? (darkMode ? '#333333' : 'white') : 'transparent',
                color: activeView === 'beatboard' ? (darkMode ? 'white' : 'black') : '#6b7280',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                boxShadow: activeView === 'beatboard' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1"/>
                <rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/>
                <rect x="14" y="14" width="7" height="7" rx="1"/>
              </svg>
              Beat Board
            </button>
          </div>

          {/* ELEMENT TYPE SELECTOR - compact dropdown */}
          {activeView === 'script' && activeIndex !== null && activeIndex >= 0 && elements[activeIndex] && (
            <div style={{ position: 'relative', marginLeft: 8 }}>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setShowTypeMenu(!showTypeMenu); }}
                style={{
                  padding: '5px 10px',
                  border: 'none',
                  borderRadius: 6,
                  background: darkMode ? '#484848' : '#e5e7eb',
                  color: darkMode ? 'white' : '#333',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                {{ scene: 'Scène', action: 'Action', character: 'Personnage', dialogue: 'Dialogue', parenthetical: 'Parenthèse', transition: 'Transition' }[elements[activeIndex].type] || elements[activeIndex].type}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              {showTypeMenu && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 999 }} onClick={() => setShowTypeMenu(false)} />
                  <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: darkMode ? '#1e1e1e' : 'white', border: `1px solid ${darkMode ? '#555' : '#ddd'}`, borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.3)', zIndex: 1000, minWidth: 150, overflow: 'hidden' }}>
                    {[
                      { type: 'scene', label: 'Scène' },
                      { type: 'action', label: 'Action' },
                      { type: 'character', label: 'Personnage' },
                      { type: 'dialogue', label: 'Dialogue' },
                      { type: 'parenthetical', label: 'Parenthèse' },
                      { type: 'transition', label: 'Transition' },
                    ].map(({ type, label }) => (
                      <button
                        key={type}
                        type="button"
                        onClick={(e) => { e.stopPropagation(); changeType(activeIndex, type); setShowTypeMenu(false); }}
                        style={{
                          width: '100%',
                          padding: '8px 14px',
                          border: 'none',
                          background: elements[activeIndex].type === type ? (darkMode ? '#2563eb' : '#2563eb') : 'transparent',
                          color: elements[activeIndex].type === type ? 'white' : (darkMode ? '#e0e0e0' : '#333'),
                          cursor: 'pointer',
                          fontSize: 12,
                          fontWeight: elements[activeIndex].type === type ? 600 : 400,
                          textAlign: 'left',
                          display: 'block',
                        }}
                        onMouseOver={(e) => { if (elements[activeIndex].type !== type) e.target.style.background = darkMode ? '#333' : '#f3f4f6'; }}
                        onMouseOut={(e) => { if (elements[activeIndex].type !== type) e.target.style.background = 'transparent'; }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* CENTER ZONE: Title only */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'center', minWidth: 0 }}>
          <div className="header-btn" data-tooltip={title} style={{ position: 'relative' }}>
            <input 
              value={title} 
              onChange={e => docId ? emitTitle(e.target.value) : setTitle(e.target.value)} 
              placeholder={t('newDocumentPlaceholder')}
              style={{ 
                background: 'transparent', 
                border: 'none', 
                color: darkMode ? 'white' : 'black', 
                fontSize: 14, 
                fontWeight: 600, 
                outline: 'none', 
                maxWidth: 250,
                textOverflow: 'ellipsis',
                textAlign: 'center'
              }} 
            />
          </div>
          {docId && offlineDocId && <span style={{ fontSize: 10, color: '#f59e0b', whiteSpace: 'nowrap' }}>{t('offlineCopyBadge')}</span>}
          {docId && !offlineDocId && lastSaved && <span style={{ fontSize: 10, color: '#6b7280', whiteSpace: 'nowrap' }}>✓ {lastSaved.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>}
          {docId && !isFullyConnected && !offlineDocId && <span style={{ fontSize: 10, color: '#f59e0b', whiteSpace: 'nowrap' }}>⚠ Offline</span>}
          {docId && !canEdit && <span style={{ fontSize: 10, background: '#f59e0b', color: 'black', padding: '2px 6px', borderRadius: 4 }}>{t('reading')}</span>}
          {loading && <span style={{ fontSize: 11, color: '#60a5fa', display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ display: 'inline-block', width: 8, height: 8, border: '2px solid #60a5fa', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /> {t('loading')}</span>}
          {importing && <span style={{ fontSize: 11, color: '#f59e0b' }}>Import en cours...</span>}
        </div>
        
        {/* RIGHT ZONE: User/Collab + Toggles */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {/* User & Collaborators */}
          {currentUser ? (
            <>
              <div style={{ position: 'relative' }}>
                <UserAvatar user={{ name: currentUser.name, color: users.find(u => u.name === currentUser.name)?.color || currentUser.color || '#3b82f6' }} isYou={true} />
                <button 
                  onClick={handleLogout} 
                  style={{ position: 'absolute', top: -4, right: -4, width: 14, height: 14, borderRadius: '50%', background: '#ef4444', border: 'none', color: 'white', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }} 
                  title={t('logout')}
                >×</button>
              </div>
              {docId && users.filter(u => u.id !== myId).slice(0, 3).map((u) => (
                <div key={u.id} style={{ marginLeft: -6 }}><UserAvatar user={u} isYou={false} /></div>
              ))}
              {docId && users.length > 4 && <span style={{ color: '#9ca3af', fontSize: 10, marginLeft: 2 }}>+{users.length - 4}</span>}
            </>
          ) : (
            <button onClick={() => setShowAuthModal(true)} style={{ padding: '4px 10px', border: `1px solid ${darkMode ? '#555555' : '#d1d5db'}`, borderRadius: 6, background: 'transparent', color: '#9ca3af', cursor: 'pointer', fontSize: 11 }}>{t('connection')}</button>
          )}
          
          {docId && (
            <>
              <button 
                onClick={copyLink} 
                className="header-btn"
                data-tooltip={t('invite')}
                style={{ marginLeft: 4, width: 24, height: 24, borderRadius: '50%', border: `1px dashed ${darkMode ? '#555555' : '#d1d5db'}`, background: 'transparent', color: '#9ca3af', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </button>
              <button
                onClick={() => setShowChat(!showChat)}
                className="header-btn"
                data-tooltip={t('teamChat')}
                style={{ marginLeft: 2, width: 24, height: 24, borderRadius: '50%', border: 'none', background: showChat ? '#3b82f6' : (darkMode ? '#484848' : '#e5e7eb'), color: showChat ? 'white' : '#6b7280', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                {unreadMessages > 0 && <span style={{ position: 'absolute', top: -4, right: -4, background: '#ef4444', color: 'white', fontSize: 8, fontWeight: 'bold', padding: '1px 4px', borderRadius: 8, minWidth: 14, textAlign: 'center' }}>{unreadMessages > 9 ? '9+' : unreadMessages}</span>}
              </button>
            </>
          )}
          
          <div style={{ width: 1, height: 20, background: darkMode ? '#484848' : '#d1d5db', margin: '0 6px' }} />
          
          {/* Document actions */}
          <button
            onClick={() => setShowDocsList(true)}
            className="header-btn"
            data-tooltip={t('myDocuments')}
            style={{ width: 32, height: 32, borderRadius: 6, border: 'none', background: darkMode ? '#484848' : '#f3f4f6', color: '#6b7280', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
          </button>
          
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="header-btn"
            data-tooltip={t('export')}
            style={{ width: 32, height: 32, borderRadius: 6, border: 'none', background: showExportMenu ? '#3b82f6' : (darkMode ? '#484848' : '#f3f4f6'), color: showExportMenu ? 'white' : '#6b7280', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
              <polyline points="17 21 17 13 7 13 7 21"/>
              <polyline points="7 3 7 8 15 8"/>
            </svg>
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', bottom: 4, right: 4 }}>
              <polyline points="18 15 12 9 6 15"/>
            </svg>
          </button>
          
          {/* Export dropdown menu */}
          {showExportMenu && (
            <>
              <div 
                style={{ position: 'fixed', inset: 0, zIndex: 999 }} 
                onClick={() => setShowExportMenu(false)} 
              />
              <div style={{
                position: 'absolute',
                top: 50,
                right: 'auto',
                background: darkMode ? '#333333' : 'white',
                borderRadius: 8,
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                border: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`,
                zIndex: 1000,
                minWidth: 160,
                overflow: 'hidden'
              }}>
                <button
                  onClick={() => { exportFDX(); setShowExportMenu(false); }}
                  style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  Export FDX
                </button>
                <button
                  onClick={() => { exportPDF(); setShowExportMenu(false); }}
                  style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                  Export PDF
                </button>
                <button
                  onClick={() => { exportFountain(); setShowExportMenu(false); }}
                  style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2c2 4 4 6 4 10a4 4 0 1 1-8 0c0-4 2-6 4-10z"/></svg>
                  Export Fountain
                </button>
              </div>
            </>
          )}
          
          <div style={{ width: 1, height: 20, background: darkMode ? '#484848' : '#d1d5db', margin: '0 6px' }} />
          
          {/* Quick toggle buttons */}
          <button
            onClick={() => setShowOutline(!showOutline)}
            className="header-btn"
            data-tooltip={`${t('outline')} (⌘O)`}
            style={{ width: 32, height: 32, borderRadius: 6, border: 'none', background: showOutline ? '#3b82f6' : (darkMode ? '#484848' : '#f3f4f6'), color: showOutline ? 'white' : '#6b7280', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="8" y1="6" x2="21" y2="6"/>
              <line x1="8" y1="12" x2="21" y2="12"/>
              <line x1="8" y1="18" x2="21" y2="18"/>
              <line x1="3" y1="6" x2="3.01" y2="6"/>
              <line x1="3" y1="12" x2="3.01" y2="12"/>
              <line x1="3" y1="18" x2="3.01" y2="18"/>
            </svg>
          </button>
          
          <button
            onClick={() => setShowComments(!showComments)}
            className="header-btn"
            data-tooltip={t('comments')}
            style={{ width: 32, height: 32, borderRadius: 6, border: 'none', background: showComments ? '#3b82f6' : (darkMode ? '#484848' : '#f3f4f6'), color: showComments ? 'white' : '#6b7280', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
            </svg>
            {totalComments > 0 && <span style={{ position: 'absolute', top: -2, right: -2, background: '#f59e0b', color: 'black', fontSize: 8, fontWeight: 'bold', padding: '1px 4px', borderRadius: 8, minWidth: 14, textAlign: 'center' }}>{totalComments}</span>}
          </button>
          
          <button
            onClick={() => setShowTimer(!showTimer)}
            className="header-btn"
            data-tooltip={t('writingTimer')}
            style={{ width: 32, height: 32, borderRadius: 6, border: 'none', background: showTimer ? '#3b82f6' : (darkMode ? '#484848' : '#f3f4f6'), color: showTimer ? 'white' : '#6b7280', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="13" r="8"/>
              <path d="M12 9v4l2 2"/>
              <path d="M9 2h6"/>
              <path d="M12 2v2"/>
            </svg>
          </button>
          
          <button
            onClick={() => setFocusMode(!focusMode)}
            className="header-btn"
            data-tooltip={t('focusMode')}
            style={{ width: 32, height: 32, borderRadius: 6, border: 'none', background: focusMode ? '#3b82f6' : (darkMode ? '#484848' : '#f3f4f6'), color: focusMode ? 'white' : '#6b7280', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <circle cx="12" cy="12" r="6"/>
              <circle cx="12" cy="12" r="2"/>
            </svg>
          </button>
          
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="header-btn"
            data-tooltip={darkMode ? t('lightMode') : t('darkModeTooltip')}
            style={{ width: 32, height: 32, borderRadius: 6, border: 'none', background: darkMode ? '#484848' : '#f3f4f6', color: '#6b7280', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {darkMode ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/>
                <line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/>
                <line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
          </button>
        </div>
      </div>
      
      {/* OFFLINE BANNER */}
      {docId && docId !== 'local' && !isFullyConnected && !offlineDocId && (
        <div style={{
          background: darkMode ? '#92400e' : '#fef3c7',
          color: darkMode ? '#fef3c7' : '#92400e',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          fontSize: 13,
          fontWeight: 500,
          borderBottom: `1px solid ${darkMode ? '#78350f' : '#fde68a'}`,
          flexShrink: 0,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <span>{t('offlineBanner')}</span>
          <button
            onClick={activateOfflineMode}
            style={{
              padding: '4px 12px',
              borderRadius: 6,
              border: 'none',
              background: darkMode ? '#f59e0b' : '#92400e',
              color: darkMode ? '#1a1a1a' : 'white',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {t('offlineWorkCopy')}
          </button>
        </div>
      )}

      {/* OFFLINE MODE BANNER */}
      {offlineDocId && !isFullyConnected && (
        <div style={{
          background: darkMode ? '#1e3a5f' : '#dbeafe',
          color: darkMode ? '#93c5fd' : '#1e40af',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          fontSize: 13,
          fontWeight: 500,
          borderBottom: `1px solid ${darkMode ? '#1e3a5f' : '#93c5fd'}`,
          flexShrink: 0,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/></svg>
          <span>{t('offlineMode')}</span>
        </div>
      )}

      {/* CONNECTION RESTORED BANNER (offline mode + back online) */}
      {offlineDocId && isFullyConnected && (
        <div style={{
          background: darkMode ? '#064e3b' : '#d1fae5',
          color: darkMode ? '#6ee7b7' : '#065f46',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          fontSize: 13,
          fontWeight: 500,
          borderBottom: `1px solid ${darkMode ? '#065f46' : '#6ee7b7'}`,
          flexShrink: 0,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <span>{t('connectionRestored')}</span>
          <button
            onClick={() => pushOfflineChanges(false)}
            style={{
              padding: '4px 12px',
              borderRadius: 6,
              border: 'none',
              background: darkMode ? '#10b981' : '#065f46',
              color: 'white',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {t('pushChanges')}
          </button>
          <button
            onClick={discardOfflineCopy}
            style={{
              padding: '4px 12px',
              borderRadius: 6,
              border: `1px solid ${darkMode ? '#6ee7b7' : '#065f46'}`,
              background: 'transparent',
              color: darkMode ? '#6ee7b7' : '#065f46',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {t('discardOffline')}
          </button>
        </div>
      )}

      {/* CONFLICT MODAL */}
      {showConflictModal && (
        <>
          <div onClick={() => setShowConflictModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999 }} />
          <div style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: darkMode ? '#2b2b2b' : 'white',
            borderRadius: 12,
            padding: 24,
            width: 420,
            maxWidth: '90vw',
            zIndex: 10000,
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <span style={{ fontSize: 16, fontWeight: 700, color: darkMode ? 'white' : '#1a1a1a' }}>{t('conflictTitle')}</span>
            </div>
            <p style={{ fontSize: 13, color: darkMode ? '#9ca3af' : '#6b7280', marginBottom: 20, lineHeight: 1.5 }}>
              {t('conflictMessage')}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Only show overwrite if doc is NOT shared with others */}
              {collaborators.length <= 1 && (
                <button onClick={() => pushOfflineChanges(true)} style={{
                  padding: '10px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: '#ef4444', color: 'white', fontSize: 13, fontWeight: 600,
                }}>{t('conflictOverwrite')}</button>
              )}
              <button onClick={discardOfflineCopy} style={{
                padding: '10px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: darkMode ? '#484848' : '#f3f4f6', color: darkMode ? 'white' : '#1a1a1a', fontSize: 13, fontWeight: 600,
              }}>{t('conflictKeepOnline')}</button>
              <button onClick={() => { window.open(window.location.href, '_blank'); setShowConflictModal(false); }} style={{
                padding: '10px 16px', borderRadius: 8, border: `1px solid ${darkMode ? '#484848' : '#d1d5db'}`, cursor: 'pointer',
                background: darkMode ? '#3b82f6' : '#2563eb', color: 'white', fontSize: 13, fontWeight: 600,
              }}>{t('conflictCompare')}</button>
            </div>
          </div>
        </>
      )}

      {/* SHARE LINK MODAL */}
      {showShareModal && (
        <>
          <div onClick={() => setShowShareModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 9999 }} />
          <div style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: darkMode ? '#2b2b2b' : 'white',
            borderRadius: 12,
            padding: 24,
            width: 440,
            maxWidth: '90vw',
            zIndex: 10000,
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: darkMode ? 'white' : '#1a1a1a' }}>{t('invite')}</span>
              <button onClick={() => setShowShareModal(false)} style={{ background: 'none', border: 'none', color: darkMode ? '#9ca3af' : '#6b7280', cursor: 'pointer', fontSize: 18 }}>&times;</button>
            </div>
            {/* Public access toggle */}
            {isOwner && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div
                  onClick={() => togglePublicAccess(!publicAccessState.enabled)}
                  style={{
                    width: 38, height: 20, borderRadius: 10, cursor: 'pointer',
                    background: publicAccessState.enabled ? '#22c55e' : (darkMode ? '#4b5563' : '#d1d5db'),
                    position: 'relative', transition: 'background 0.2s',
                  }}
                >
                  <div style={{
                    width: 16, height: 16, borderRadius: '50%', background: 'white',
                    position: 'absolute', top: 2, left: publicAccessState.enabled ? 20 : 2,
                    transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  }} />
                </div>
                <span style={{ fontSize: 12, color: darkMode ? '#d1d5db' : '#374151' }}>
                  {language === 'fr' ? 'Lien actif' : 'Link active'}
                </span>
                {publicAccessState.enabled && (
                  <select
                    value={publicAccessState.role}
                    onChange={(e) => changePublicRole(e.target.value)}
                    style={{
                      marginLeft: 'auto', padding: '4px 8px', borderRadius: 6, fontSize: 11,
                      border: `1px solid ${darkMode ? '#484848' : '#d1d5db'}`,
                      background: darkMode ? '#1a1a1a' : '#f9fafb',
                      color: darkMode ? '#e0e0e0' : '#1a1a1a', cursor: 'pointer', outline: 'none',
                    }}
                  >
                    <option value="viewer">{language === 'fr' ? 'Lecture seule' : 'View only'}</option>
                    <option value="commenter">{language === 'fr' ? 'Commentaire' : 'Comment'}</option>
                    <option value="editor">{language === 'fr' ? 'Éditeur' : 'Editor'}</option>
                  </select>
                )}
              </div>
            )}

            {publicAccessState.enabled ? (
              <>
                <p style={{ fontSize: 12, color: darkMode ? '#9ca3af' : '#6b7280', marginBottom: 12 }}>
                  {language === 'fr' ? 'Toute personne ayant ce lien peut accéder au document :' : 'Anyone with this link can access the document:'}
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    readOnly
                    value={shareLink}
                    onClick={e => e.target.select()}
                    style={{
                      flex: 1, padding: '10px 12px', borderRadius: 8,
                      border: `1px solid ${darkMode ? '#484848' : '#d1d5db'}`,
                      background: darkMode ? '#1a1a1a' : '#f9fafb',
                      color: darkMode ? '#e0e0e0' : '#1a1a1a',
                      fontSize: 12, fontFamily: 'monospace', outline: 'none',
                    }}
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(shareLink);
                      const btn = document.getElementById('share-copy-btn');
                      if (btn) { btn.textContent = language === 'fr' ? 'Copié !' : 'Copied!'; setTimeout(() => { btn.textContent = language === 'fr' ? 'Copier' : 'Copy'; }, 2000); }
                    }}
                    id="share-copy-btn"
                    style={{
                      padding: '10px 16px', borderRadius: 8, border: 'none',
                      background: '#3b82f6', color: 'white', fontSize: 12,
                      fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                    }}
                  >
                    {language === 'fr' ? 'Copier' : 'Copy'}
                  </button>
                </div>
              </>
            ) : (
              <p style={{ fontSize: 12, color: darkMode ? '#6b7280' : '#9ca3af', textAlign: 'center', padding: '16px 0' }}>
                {language === 'fr' ? 'Activez le lien pour partager ce document.' : 'Enable the link to share this document.'}
              </p>
            )}
          </div>
        </>
      )}

      {/* MAIN CONTENT AREA - Flex layout with sidebars */}
      <div style={{ 
        flex: 1,
        display: activeView === 'script' ? 'flex' : 'none', 
        overflow: 'auto',
        position: 'relative'
      }}>
        {/* Loading Overlay */}
        {loading && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: darkMode ? 'rgba(43, 43, 43, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100
          }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={darkMode ? '#60a5fa' : '#3b82f6'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
            <p style={{ marginTop: 16, color: darkMode ? '#9ca3af' : '#6b7280', fontSize: 14 }}>
              {t('loadingDocument')}
            </p>
            <style>{`
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        )}
        
        {/* LEFT SIDEBAR - Outline */}
        {showOutline && (
          <div style={{ 
            width: 300,
            minWidth: 200,
            flexShrink: 1,
            background: darkMode ? '#333333' : 'white', 
            borderRight: `1px solid ${darkMode ? '#484848' : '#d1d5db'}`, 
            display: 'flex', 
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            <div style={{ padding: 16, borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 16, color: darkMode ? 'white' : 'black', display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="8" y1="6" x2="21" y2="6"/>
                  <line x1="8" y1="12" x2="21" y2="12"/>
                  <line x1="8" y1="18" x2="21" y2="18"/>
                  <line x1="3" y1="6" x2="3.01" y2="6"/>
                  <line x1="3" y1="12" x2="3.01" y2="12"/>
                  <line x1="3" y1="18" x2="3.01" y2="18"/>
                </svg>
                Outline
              </h3>
              <button onClick={() => setShowOutline(false)} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>✕</button>
            </div>
            
            {/* Filters */}
            <div style={{ padding: '10px 12px', borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, display: 'flex', gap: 6 }}>
              {/* Custom Status Dropdown */}
              <div style={{ flex: 1, position: 'relative' }}>
                <button
                  onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                  style={{ 
                    width: '100%',
                    padding: '6px 10px', 
                    background: outlineFilter.status ? (darkMode ? '#4a4a4a' : '#dbeafe') : (darkMode ? '#484848' : '#f3f4f6'), 
                    border: `1px solid ${darkMode ? '#555555' : '#e5e7eb'}`,
                    borderRadius: 6, 
                    color: darkMode ? '#e5e7eb' : '#484848', 
                    fontSize: 11,
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 6
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {outlineFilter.status === 'progress' && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} />}
                    {outlineFilter.status === 'done' && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }} />}
                    {outlineFilter.status === 'urgent' && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />}
                    {outlineFilter.status === 'none' && <span style={{ width: 8, height: 8, borderRadius: '50%', border: '1px solid #6b7280', background: 'transparent' }} />}
                    {outlineFilter.status === 'progress' ? t('inProgress') : outlineFilter.status === 'done' ? t('validated') : outlineFilter.status === 'urgent' ? t('urgent') : outlineFilter.status === 'none' ? t('notDefined') : t('status')}
                  </span>
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="#6b7280"><path d="M3 4.5L6 8l3-3.5H3z"/></svg>
                </button>
                {showStatusDropdown && (
                  <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 998 }} onClick={() => setShowStatusDropdown(false)} />
                    <div style={{ 
                      position: 'absolute', 
                      top: '100%', 
                      left: 0, 
                      right: 0,
                      marginTop: 4,
                      background: darkMode ? '#333333' : 'white', 
                      border: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`,
                      borderRadius: 6,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      zIndex: 999,
                      overflow: 'hidden'
                    }}>
                      <button onClick={() => { setOutlineFilter(f => ({ ...f, status: '' })); setShowStatusDropdown(false); }} style={{ width: '100%', padding: '8px 10px', background: 'transparent', border: 'none', color: darkMode ? '#e5e7eb' : '#484848', fontSize: 11, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }} onMouseEnter={e => e.currentTarget.style.background = darkMode ? '#484848' : '#f3f4f6'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        {t('allStatuses')}
                      </button>
                      <button onClick={() => { setOutlineFilter(f => ({ ...f, status: 'progress' })); setShowStatusDropdown(false); }} style={{ width: '100%', padding: '8px 10px', background: 'transparent', border: 'none', color: darkMode ? '#e5e7eb' : '#484848', fontSize: 11, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }} onMouseEnter={e => e.currentTarget.style.background = darkMode ? '#484848' : '#f3f4f6'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} />
                        {t('inProgress')}
                      </button>
                      <button onClick={() => { setOutlineFilter(f => ({ ...f, status: 'done' })); setShowStatusDropdown(false); }} style={{ width: '100%', padding: '8px 10px', background: 'transparent', border: 'none', color: darkMode ? '#e5e7eb' : '#484848', fontSize: 11, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }} onMouseEnter={e => e.currentTarget.style.background = darkMode ? '#484848' : '#f3f4f6'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }} />
                        {t('validated')}
                      </button>
                      <button onClick={() => { setOutlineFilter(f => ({ ...f, status: 'urgent' })); setShowStatusDropdown(false); }} style={{ width: '100%', padding: '8px 10px', background: 'transparent', border: 'none', color: darkMode ? '#e5e7eb' : '#484848', fontSize: 11, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }} onMouseEnter={e => e.currentTarget.style.background = darkMode ? '#484848' : '#f3f4f6'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
                        {t('urgent')}
                      </button>
                      <button onClick={() => { setOutlineFilter(f => ({ ...f, status: 'none' })); setShowStatusDropdown(false); }} style={{ width: '100%', padding: '8px 10px', background: 'transparent', border: 'none', color: darkMode ? '#e5e7eb' : '#484848', fontSize: 11, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }} onMouseEnter={e => e.currentTarget.style.background = darkMode ? '#484848' : '#f3f4f6'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', border: '1px solid #6b7280', background: 'transparent' }} />
                        {t('notDefined')}
                      </button>
                    </div>
                  </>
                )}
              </div>
              {/* Custom Assignee Dropdown */}
              <div style={{ flex: 1, position: 'relative' }}>
                <button
                  onClick={() => setShowAssigneeDropdown(!showAssigneeDropdown)}
                  style={{ 
                    width: '100%',
                    padding: '6px 10px', 
                    background: outlineFilter.assignee ? (darkMode ? '#4a4a4a' : '#dbeafe') : (darkMode ? '#484848' : '#f3f4f6'), 
                    border: `1px solid ${darkMode ? '#555555' : '#e5e7eb'}`,
                    borderRadius: 6, 
                    color: darkMode ? '#e5e7eb' : '#484848', 
                    fontSize: 11,
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 6
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {outlineFilter.assignee === 'unassigned' ? t('unassigned') : outlineFilter.assignee || t('assigned')}
                  </span>
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="#6b7280" style={{ flexShrink: 0 }}><path d="M3 4.5L6 8l3-3.5H3z"/></svg>
                </button>
                {showAssigneeDropdown && (
                  <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 998 }} onClick={() => setShowAssigneeDropdown(false)} />
                    <div style={{ 
                      position: 'absolute', 
                      top: '100%', 
                      left: 0, 
                      right: 0,
                      marginTop: 4,
                      background: darkMode ? '#333333' : 'white', 
                      border: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`,
                      borderRadius: 6,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      zIndex: 999,
                      overflow: 'hidden',
                      maxHeight: 200,
                      overflowY: 'auto'
                    }}>
                      <button onClick={() => { setOutlineFilter(f => ({ ...f, assignee: '' })); setShowAssigneeDropdown(false); }} style={{ width: '100%', padding: '8px 10px', background: 'transparent', border: 'none', color: darkMode ? '#e5e7eb' : '#484848', fontSize: 11, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }} onMouseEnter={e => e.currentTarget.style.background = darkMode ? '#484848' : '#f3f4f6'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        {t('allAssignees')}
                      </button>
                      <button onClick={() => { setOutlineFilter(f => ({ ...f, assignee: 'unassigned' })); setShowAssigneeDropdown(false); }} style={{ width: '100%', padding: '8px 10px', background: 'transparent', border: 'none', color: darkMode ? '#e5e7eb' : '#484848', fontSize: 11, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }} onMouseEnter={e => e.currentTarget.style.background = darkMode ? '#484848' : '#f3f4f6'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <span style={{ width: 16, height: 16, borderRadius: 3, border: '1px dashed #6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8 }}>✕</span>
                        {t('unassigned')}
                      </button>
                      {(() => {
                        // Merge and sync colors with online users
                        const allUsers = collaborators.map(collab => {
                          const onlineUser = users.find(u => u.name === collab.name);
                          return { ...collab, color: onlineUser?.color || collab.color };
                        });
                        users.forEach(onlineUser => {
                          if (!allUsers.find(c => c.name === onlineUser.name)) {
                            allUsers.push({ name: onlineUser.name, color: onlineUser.color });
                          }
                        });
                        return allUsers;
                      })().map(u => {
                        const onlineUser = users.find(online => online.name === u.name);
                        const displayColor = onlineUser?.color || u.color;
                        return (
                        <button key={u.name} onClick={() => { setOutlineFilter(f => ({ ...f, assignee: u.name })); setShowAssigneeDropdown(false); }} style={{ width: '100%', padding: '8px 10px', background: 'transparent', border: 'none', color: darkMode ? '#e5e7eb' : '#484848', fontSize: 11, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }} onMouseEnter={e => e.currentTarget.style.background = darkMode ? '#484848' : '#f3f4f6'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <span style={{ width: 16, height: 16, borderRadius: 3, background: displayColor, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 'bold' }}>{getInitials(u.name)}</span>
                          {u.name}
                          {onlineUser && (
                            <span style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
                          )}
                        </button>
                      );})}
                    </div>
                  </>
                )}
              </div>
            </div>
            {(outlineFilter.status || outlineFilter.assignee) && (
              <div style={{ padding: '4px 12px', background: darkMode ? '#484848' : '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 10, color: darkMode ? '#fbbf24' : '#92400e' }}>
                  {filteredOutline.length} scène{filteredOutline.length > 1 ? 's' : ''} filtrée{filteredOutline.length > 1 ? 's' : ''}
                </span>
                <button onClick={() => setOutlineFilter({ status: '', assignee: '' })} style={{ padding: '4px 8px', fontSize: 10, background: '#ef4444', border: 'none', borderRadius: 4, color: 'white', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            )}
            <div ref={outlineSidebarRef} style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
              {filteredOutline.length === 0 ? (
                <p style={{ color: '#6b7280', textAlign: 'center', padding: 20, fontSize: 13 }}>Aucune scène</p>
              ) : (
                filteredOutline.map((scene, sceneIdx) => {
                  // Find linked card to get its color
                  const linkedCard = beatCards.find(c => c.linkedSceneId === scene.id);
                  const cardColor = linkedCard?.color && linkedCard.color !== '#ffffff' ? linkedCard.color : null;
                  // Find structure beat that starts at this scene
                  const chapterBeat = structureBeats.find(b => b.startSceneId === scene.id);
                  
                  return (
                  <React.Fragment key={scene.id}>
                  {chapterBeat && (
                    <div 
                      style={{ 
                        padding: '8px 12px', 
                        background: chapterBeat.color || (darkMode ? '#4a4a4a' : '#dbeafe'), 
                        borderLeft: `3px solid ${chapterBeat.color || '#3b82f6'}`,
                        margin: '4px 8px',
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 600,
                        color: chapterBeat.color ? 'white' : (darkMode ? '#93c5fd' : '#1e40af'),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <span>📁 {chapterBeat.label}</span>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setStructureBeats(prev => prev.filter(b => b.id !== chapterBeat.id)); }}
                        style={{ background: 'none', border: 'none', color: chapterBeat.color ? 'rgba(255,255,255,0.7)' : '#6b7280', cursor: 'pointer', fontSize: 12, padding: 0 }}
                      >✕</button>
                    </div>
                  )}
                  <div 
                    data-outline-element-index={scene.index}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = 'move';
                      setOutlineDragIndex(sceneIdx);
                    }}
                    onDragEnd={() => {
                      setOutlineDragIndex(null);
                      setOutlineDropIndex(null);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      if (outlineDragIndex !== null && outlineDragIndex !== sceneIdx) {
                        // Determine if dropping before or after based on mouse position
                        const rect = e.currentTarget.getBoundingClientRect();
                        const midY = rect.top + rect.height / 2;
                        const dropBefore = e.clientY < midY;
                        setOutlineDropIndex({ index: sceneIdx, position: dropBefore ? 'before' : 'after' });
                      }
                    }}
                    onDragLeave={() => {
                      setOutlineDropIndex(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (outlineDragIndex === null || !outlineDropIndex) return;
                      
                      const targetIdx = outlineDropIndex.index;
                      const dropBefore = outlineDropIndex.position === 'before';
                      
                      // Don't drop on self or adjacent position that would result in no change
                      if (outlineDragIndex === targetIdx) return;
                      if (dropBefore && outlineDragIndex === targetIdx - 1) return;
                      if (!dropBefore && outlineDragIndex === targetIdx + 1) return;
                      
                      // Get the actual scene objects
                      const draggedSceneObj = filteredOutline[outlineDragIndex];
                      const targetSceneObj = filteredOutline[targetIdx];
                      
                      if (!draggedSceneObj || !targetSceneObj) return;
                      
                      // Save state before modification for undo
                      pushToUndo();
                      
                      // Find scene boundaries in elements array
                      const sceneIndices = elements.map((el, i) => el.type === 'scene' ? i : -1).filter(i => i >= 0);
                      
                      // Get the dragged scene's elements (from scene to next scene or end)
                      const draggedScenePos = sceneIndices.indexOf(draggedSceneObj.index);
                      const draggedStart = draggedSceneObj.index;
                      const draggedEnd = draggedScenePos < sceneIndices.length - 1 
                        ? sceneIndices[draggedScenePos + 1] 
                        : elements.length;
                      const draggedElements = elements.slice(draggedStart, draggedEnd);
                      
                      // Remove dragged elements from array
                      let newElements = [...elements];
                      newElements.splice(draggedStart, draggedElements.length);
                      
                      // Recalculate scene indices after removal
                      const newSceneIndices = newElements.map((el, i) => el.type === 'scene' ? i : -1).filter(i => i >= 0);
                      
                      // Find target position in new array
                      const targetSceneInNew = newElements.findIndex(el => el.id === targetSceneObj.id);
                      const targetScenePosInNew = newSceneIndices.indexOf(targetSceneInNew);
                      
                      let insertPos;
                      if (dropBefore) {
                        insertPos = targetSceneInNew;
                      } else {
                        // Insert after target scene's elements
                        insertPos = targetScenePosInNew < newSceneIndices.length - 1
                          ? newSceneIndices[targetScenePosInNew + 1]
                          : newElements.length;
                      }
                      
                      // Insert dragged elements at new position
                      newElements.splice(insertPos, 0, ...draggedElements);
                      
                      setElements(newElements);
                      
                      // Also update timeline order to match new scene order
                      // Get new scene order
                      const newSceneOrder = newElements.filter(el => el.type === 'scene').map(el => el.id);
                      
                      // Update beatCards timelineIndex to match new scene order (for cards in timeline)
                      setBeatCards(prev => {
                        const cardsInTimeline = prev.filter(c => c.timelineIndex !== null && c.linkedSceneId);
                        if (cardsInTimeline.length === 0) return prev;
                        
                        // Sort cards by their scene's new position
                        const sortedCards = [...cardsInTimeline].sort((a, b) => {
                          const aPos = newSceneOrder.indexOf(a.linkedSceneId);
                          const bPos = newSceneOrder.indexOf(b.linkedSceneId);
                          return aPos - bPos;
                        });
                        
                        // Create new timelineIndex mapping
                        const newIndexMap = {};
                        sortedCards.forEach((card, idx) => {
                          newIndexMap[card.id] = idx;
                        });
                        
                        return prev.map(c => {
                          if (newIndexMap[c.id] !== undefined) {
                            return { ...c, timelineIndex: newIndexMap[c.id] };
                          }
                          return c;
                        });
                      });
                      
                      if (socketRef.current && connected && canEdit) {
                        socketRef.current.emit('full-sync', { elements: newElements });
                      }
                      
                      setOutlineDragIndex(null);
                      setOutlineDropIndex(null);
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveIndex(scene.index);
                      // Scroll the script container to this scene
                      setTimeout(() => {
                        const script = scriptContainerRef.current;
                        const el = document.querySelector(`[data-element-id="${scene.id}"]`);
                        if (script && el) {
                          const scriptRect = script.getBoundingClientRect();
                          const elRect = el.getBoundingClientRect();
                          const targetScroll = script.scrollTop + (elRect.top - scriptRect.top) - 50;
                          script.scrollTop = Math.max(0, targetScroll);
                        }
                      }, 50);
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      const existingBeat = structureBeats.find(b => b.startSceneId === scene.id);
                      const chapterName = prompt('Nom du chapitre/acte à insérer avant cette scène:', existingBeat?.label || '');
                      if (chapterName !== null) {
                        if (chapterName.trim()) {
                          if (existingBeat) {
                            setStructureBeats(prev => prev.map(b => b.id === existingBeat.id ? { ...b, label: chapterName.trim() } : b));
                          } else {
                            setStructureBeats(prev => [...prev, { id: 'struct_' + Date.now(), label: chapterName.trim(), startSceneId: scene.id, color: null }]);
                          }
                        } else if (existingBeat) {
                          setStructureBeats(prev => prev.filter(b => b.id !== existingBeat.id));
                        }
                      }
                    }}
                    style={{ 
                      padding: '10px 12px', 
                      paddingLeft: cardColor ? 0 : 12,
                      cursor: outlineDragIndex !== null ? 'grabbing' : 'grab', 
                      background: activeIndex === scene.index 
                          ? (darkMode ? '#484848' : '#f3f4f6')
                          : 'transparent',
                      borderBottom: `1px solid ${darkMode ? '#484848' : '#f3f4f6'}`,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0,
                      opacity: outlineDragIndex === sceneIdx ? 0.5 : 1,
                      position: 'relative'
                    }}
                  >
                    {/* Drop indicator line - before */}
                    {outlineDropIndex?.index === sceneIdx && outlineDropIndex?.position === 'before' && (
                      <div style={{
                        position: 'absolute',
                        top: -1,
                        left: 8,
                        right: 8,
                        height: 2,
                        background: '#3b82f6',
                        borderRadius: 1,
                        boxShadow: '0 0 4px #3b82f6'
                      }} />
                    )}
                    {/* Drop indicator line - after */}
                    {outlineDropIndex?.index === sceneIdx && outlineDropIndex?.position === 'after' && (
                      <div style={{
                        position: 'absolute',
                        bottom: -1,
                        left: 8,
                        right: 8,
                        height: 2,
                        background: '#3b82f6',
                        borderRadius: 1,
                        boxShadow: '0 0 4px #3b82f6'
                      }} />
                    )}
                    <span style={{ 
                      fontSize: 10, 
                      color: cardColor ? 'white' : '#6b7280', 
                      minWidth: cardColor ? 32 : 28,
                      textAlign: 'center',
                      padding: '4px 0',
                      marginRight: 8,
                      background: cardColor || 'transparent',
                      borderRadius: cardColor ? '0' : 0,
                      fontWeight: cardColor ? 600 : 400
                    }}>{sceneIdx + 1}</span>
                    <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                      <div style={{ 
                        fontSize: 12, 
                        fontWeight: 500, 
                        color: darkMode ? 'white' : 'black',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>{stripHtml(scene.content) || 'Scène vide'}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setLockedScenes(prev => {
                            const newSet = new Set(prev);
                            if (newSet.has(scene.id)) newSet.delete(scene.id);
                            else newSet.add(scene.id);
                            return newSet;
                          });
                        }}
                        style={{ 
                          background: lockedScenes.has(scene.id) ? 'rgba(239, 68, 68, 0.2)' : 'none', 
                          border: 'none', 
                          color: lockedScenes.has(scene.id) ? '#ef4444' : '#6b7280', 
                          cursor: 'pointer', 
                          fontSize: 11, 
                          padding: '3px 4px',
                          borderRadius: 4,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        className="outline-btn"
                        data-tooltip={lockedScenes.has(scene.id) ? t('unlockScene') : t('lockScene')}
                      >
                        {lockedScenes.has(scene.id) ? (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                        ) : (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
                        )}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const statuses = ['', 'progress', 'done', 'urgent'];
                          const currentIdx = statuses.indexOf(sceneStatus[scene.id] || '');
                          setSceneStatus(prev => ({ ...prev, [scene.id]: statuses[(currentIdx + 1) % 4] }));
                        }}
                        style={{ 
                          minWidth: 22,
                          height: 18, 
                          borderRadius: 4, 
                          border: !sceneStatus[scene.id] ? '1px dashed #6b7280' : 'none',
                          background: sceneStatus[scene.id] === 'done' ? '#22c55e' 
                            : sceneStatus[scene.id] === 'progress' ? '#f59e0b' 
                            : sceneStatus[scene.id] === 'urgent' ? '#ef4444'
                            : 'transparent',
                          cursor: 'pointer', 
                          padding: '0 4px',
                          fontSize: 10,
                          fontWeight: 'bold',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        className="outline-btn"
                        data-tooltip={sceneStatus[scene.id] === 'done' ? t('validated') 
                          : sceneStatus[scene.id] === 'progress' ? t('inProgress') 
                          : sceneStatus[scene.id] === 'urgent' ? t('urgent')
                          : t('status')}
                      >
                        {sceneStatus[scene.id] === 'done' ? '✓' 
                          : sceneStatus[scene.id] === 'progress' ? '…' 
                          : sceneStatus[scene.id] === 'urgent' ? '!'
                          : ''}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const rect = e.currentTarget.getBoundingClientRect();
                          setAssignmentMenu({
                            sceneId: scene.id,
                            x: rect.left,
                            y: rect.bottom + 4
                          });
                        }}
                        style={{ 
                          minWidth: 22,
                          height: 18, 
                          borderRadius: 4, 
                          border: sceneAssignments[scene.id] ? 'none' : '1px dashed #6b7280', 
                          background: (() => {
                            if (!sceneAssignments[scene.id]) return 'transparent';
                            const assignedName = sceneAssignments[scene.id].userName?.toLowerCase().trim();
                            const onlineUser = users.find(u => u.name?.toLowerCase().trim() === assignedName);
                            return onlineUser?.color || sceneAssignments[scene.id].userColor || '#6b7280';
                          })(), 
                          cursor: 'pointer', 
                          padding: '0 4px',
                          fontSize: 9,
                          fontWeight: 'bold',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        className="outline-btn"
                        data-tooltip={sceneAssignments[scene.id] ? `${t('assigned')} ${sceneAssignments[scene.id].userName}` : t('assignTo')}
                      >
                        {getInitials(sceneAssignments[scene.id]?.userName) || ''}
                      </button>
                    </div>
                  </div>
                  </React.Fragment>
                )})
              )}
            </div>
            <div style={{ padding: 12, borderTop: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, fontSize: 11, color: '#6b7280', textAlign: 'center' }}>
              <div>{outline.length} {outline.length > 1 ? t('scenes') : t('sceneCount')} • {t('position')}: {currentSceneNumber}/{outline.length}</div>
              <div style={{ fontSize: 10, marginTop: 4, opacity: 0.7 }}>{t('rightClickHint')}</div>
            </div>
          </div>
        )}
        
        {/* CENTER - Script content */}
        <div 
          ref={scriptContainerRef}
          className="script-container"
          style={{
            flex: 1,
            minWidth: 'fit-content',
            overflowY: 'auto',
            overflowX: 'hidden',
            display: 'flex',
            justifyContent: 'center',
            padding: 32,
            gap: 20,
            ...(isDragSelecting ? { userSelect: 'none', WebkitUserSelect: 'none', cursor: 'default' } : {}),
          }}
        >
          {/* V272: Single TipTap Editor for entire document */}
          <div className="screenplay-editor-wrapper" style={{
            background: darkMode ? '#3a3a3a' : 'white',
            color: darkMode ? '#e0e0e0' : '#111',
            width: '210mm',
            minHeight: '297mm',
            padding: '20mm 25mm 25mm 38mm',
            boxSizing: 'border-box',
            boxShadow: darkMode ? '0 4px 20px rgba(0,0,0,0.6)' : '0 4px 20px rgba(0,0,0,0.4)',
            position: 'relative',
            fontFamily: getFontFamily(scriptFont),
            fontSize: '12pt',
            lineHeight: '1',
          }}>
            <SingleEditor
              elements={elements}
              onElementsChange={handleElementsChange}
              canEdit={canEditNow}
              scriptFont={scriptFont}
              darkMode={darkMode}
              characters={extractedCharacters}
              locations={extractedLocations}
              onSelectCharacter={handleSelectChar}
              onSelectLocation={handleSelectLocation}
              onTextSelect={handleTextSelectCb}
              onHighlightClick={handleHighlightClick}
              onSuggestionClick={handleSuggestionClickCb}
              onEditorFocus={() => setScriptHasFocus(true)}
              remoteCursors={remoteCursors}
              computePageInfoFn={computePageInfo}
              highlightsByElement={highlightsByElement}
              t={t}
            />
          </div>
      </div>
      
      {/* RIGHT SIDEBAR - Comments */}
      {showComments && (
        <div style={{ 
          width: 320,
          minWidth: 250,
          flexShrink: 1,
          background: darkMode ? '#333333' : 'white', 
          borderLeft: `1px solid ${darkMode ? '#484848' : '#d1d5db'}`, 
          display: 'flex', 
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          <CommentsSidebar 
            comments={comments} 
            suggestions={suggestions}
            elements={elements} 
            activeIndex={activeIndex}
            selectedCommentIndex={selectedCommentIndex}
            selectedCommentId={selectedCommentId}
            onSelectComment={(id) => { setSelectedCommentId(id); if (id) setSelectedSuggestionId(null); }}
            elementPositions={elementPositions}
            scrollContainerRef={commentsSidebarRef}
            scriptScrollHeight={scriptScrollHeight}
            token={token} 
            docId={docId} 
            canComment={canComment}
            onClose={() => { setShowComments(false); setSelectedCommentIndex(null); setSelectedCommentId(null); setSelectedSuggestionId(null); setPendingInlineComment(null); setPendingSuggestion(null); }}
            darkMode={darkMode}
            t={t}
            onNavigateToElement={(idx) => {
              setActiveIndex(idx);
              setSelectedCommentIndex(idx);
              setTimeout(() => {
                const elId = elementsRef.current[idx]?.id;
                const el = elId ? document.querySelector(`[data-element-id="${elId}"]`) : null;
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }, 50);
            }}
            pendingInlineComment={pendingInlineComment}
            onSubmitInlineComment={(commentText) => {
              if (pendingInlineComment && commentText.trim()) {
              const newComment = {
                id: 'comment-' + Date.now(),
                elementId: pendingInlineComment.elementId,
                elementIndex: pendingInlineComment.elementIndex,
                highlight: {
                  text: pendingInlineComment.text,
                  startOffset: pendingInlineComment.startOffset,
                  endOffset: pendingInlineComment.endOffset
                },
                spans: pendingInlineComment.spans || null,
                content: commentText.trim(),
                userName: currentUser?.name || 'Anonyme',
                userColor: currentUser?.color || '#6b7280',
                createdAt: new Date().toISOString(),
                resolved: false,
                replies: []
              };
              
              setComments(prev => [...prev, newComment]);
              
              // Sync to server
              if (socketRef.current) {
                socketRef.current.emit('comment-add', { comment: newComment });
              }
              
              setPendingInlineComment(null);
            }
          }}
          onCancelInlineComment={() => setPendingInlineComment(null)}
          pendingSuggestion={pendingSuggestion}
          onSubmitSuggestion={(suggestedText) => {
            if (pendingSuggestion) {
              const newSuggestion = {
                id: 'suggestion-' + Date.now(),
                elementId: pendingSuggestion.elementId,
                elementIndex: pendingSuggestion.elementIndex,
                originalText: pendingSuggestion.originalText,
                suggestedText: suggestedText,
                startOffset: pendingSuggestion.startOffset,
                endOffset: pendingSuggestion.endOffset,
                userName: currentUser?.name || 'Anonyme',
                userColor: currentUser?.color || '#6b7280',
                createdAt: new Date().toISOString(),
                status: 'pending'
              };
              
              setSuggestions(prev => [...prev, newSuggestion]);
              
              // Sync to server
              if (socketRef.current) {
                socketRef.current.emit('suggestion-add', { suggestion: newSuggestion });
              }
              
              setPendingSuggestion(null);
            }
          }}
          onCancelSuggestion={() => setPendingSuggestion(null)}
          onAcceptSuggestion={(suggestionId) => {
            const suggestion = suggestions.find(s => s.id === suggestionId);
            if (suggestion) {
              // Apply the suggestion to the element
              const elementIndex = elements.findIndex(el => el.id === suggestion.elementId);
              if (elementIndex !== -1) {
                const element = elements[elementIndex];
                const plain = stripHtml(element.content);
                const newContent =
                  plain.substring(0, suggestion.startOffset) +
                  suggestion.suggestedText +
                  plain.substring(suggestion.endOffset);
                updateElement(elementIndex, { ...element, content: newContent });
              }
              // Remove the suggestion
              setSuggestions(prev => prev.filter(s => s.id !== suggestionId));
              if (socketRef.current) {
                socketRef.current.emit('suggestion-accept', { suggestionId });
              }
            }
          }}
          onRejectSuggestion={(suggestionId) => {
            setSuggestions(prev => prev.filter(s => s.id !== suggestionId));
            if (socketRef.current) {
              socketRef.current.emit('suggestion-reject', { suggestionId });
            }
          }}
          selectedSuggestionId={selectedSuggestionId}
          onSelectSuggestion={(id) => { setSelectedSuggestionId(id); if (id) setSelectedCommentId(null); }}
          users={users}
          collaborators={collaborators}
        />
        </div>
      )}
      </div>
      
      {/* Beat Board - Always mounted, hidden when not active */}
      <div style={{ flex: 1, display: activeView === 'beatboard' ? 'flex' : 'none', flexDirection: 'column' }}>
        <BeatBoard
          elements={elements}
          setElements={setElements}
          darkMode={darkMode}
          sceneSynopsis={sceneSynopsis}
          setSceneSynopsis={setSceneSynopsis}
          sceneStatus={sceneStatus}
          setSceneStatus={setSceneStatus}
          beatCards={beatCards}
          setBeatCards={setBeatCards}
          structureBeats={structureBeats}
          setStructureBeats={setStructureBeats}
          whiteboardElements={whiteboardElements}
          setWhiteboardElements={setWhiteboardElements}
          onPushToUndo={pushToUndo}
          isActive={activeView === 'beatboard'}
          t={t}
        />
      </div>
      
      {/* Characters Panel */}
      {showCharactersPanel && (
        <CharactersPanel 
          characterStats={characterStats}
          darkMode={darkMode}
          onClose={() => setShowCharactersPanel(false)}
          onNavigate={(idx) => {
            setActiveIndex(idx);
            setTimeout(() => {
              const elId = elementsRef.current[idx]?.id;
              const el = elId ? document.querySelector(`[data-element-id="${elId}"]`) : null;
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 50);
          }}
        />
      )}
      
      {/* Note Editor Modal - FLOATING */}
      {showNoteFor && (
        <NoteEditorModal
          elementId={showNoteFor}
          note={notes[showNoteFor]}
          onSave={updateNote}
          onPushToComment={pushNoteToComment}
          onClose={() => setShowNoteFor(null)}
          darkMode={darkMode}
          canPush={!!token && !!docId && canComment}
          position={notePosition}
          t={t}
          onDragStart={(e) => {
            e.preventDefault();
            if (e.target.tagName === 'BUTTON') return;
            setIsDraggingNote(true);
            dragOffsetRef.current = { x: e.clientX - notePosition.x, y: e.clientY - notePosition.y };
          }}
        />
      )}
      
      {/* User Assignment Context Menu */}
      {assignmentMenu && (
        <div 
          style={{ position: 'fixed', inset: 0, zIndex: 1000 }} 
          onClick={() => setAssignmentMenu(null)}
        >
          <div 
            onClick={e => e.stopPropagation()}
            style={{ 
              position: 'fixed',
              left: assignmentMenu.x,
              top: assignmentMenu.y,
              background: darkMode ? '#333333' : 'white',
              border: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`,
              borderRadius: 8,
              boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
              minWidth: 180,
              overflow: 'hidden'
            }}
          >
            <div style={{ padding: '8px 12px', borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, fontSize: 11, color: '#6b7280', fontWeight: 500 }}>
              Assigner à
            </div>
            {/* Remove assignment option */}
            <button
              onClick={() => {
                setSceneAssignments(prev => {
                  const newAssignments = { ...prev };
                  delete newAssignments[assignmentMenu.sceneId];
                  return newAssignments;
                });
                setAssignmentMenu(null);
              }}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: 'transparent',
                border: 'none',
                borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`,
                color: '#6b7280',
                fontSize: 12,
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
              onMouseEnter={e => e.currentTarget.style.background = darkMode ? '#484848' : '#f3f4f6'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ width: 24, height: 24, borderRadius: 4, border: '1px dashed #6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>✕</span>
              <span>Aucun</span>
            </button>
            {/* List all users: collaborators + online users merged */}
            {(() => {
              // Merge collaborators and online users, avoiding duplicates
              // Priority: use online user's color if they're connected (same as header avatars)
              const allUsers = collaborators.map(collab => {
                const onlineUser = users.find(u => u.name === collab.name);
                return {
                  ...collab,
                  color: onlineUser?.color || collab.color // Use online color if available
                };
              });
              users.forEach(onlineUser => {
                if (!allUsers.find(c => c.name === onlineUser.name)) {
                  allUsers.push({ name: onlineUser.name, color: onlineUser.color });
                }
              });
              return allUsers;
            })().map(user => {
              // Get the current color (prioritize online user's color)
              const onlineUser = users.find(u => u.name === user.name);
              const displayColor = onlineUser?.color || user.color;
              return (
              <button
                key={user.name}
                onClick={() => {
                  setSceneAssignments(prev => ({
                    ...prev,
                    [assignmentMenu.sceneId]: {
                      userName: user.name,
                      userColor: displayColor
                    }
                  }));
                  setAssignmentMenu(null);
                }}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: sceneAssignments[assignmentMenu.sceneId]?.userName === user.name ? (darkMode ? '#484848' : '#f3f4f6') : 'transparent',
                  border: 'none',
                  borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`,
                  color: darkMode ? 'white' : 'black',
                  fontSize: 12,
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}
                onMouseEnter={e => e.currentTarget.style.background = darkMode ? '#484848' : '#f3f4f6'}
                onMouseLeave={e => e.currentTarget.style.background = sceneAssignments[assignmentMenu.sceneId]?.userName === user.name ? (darkMode ? '#484848' : '#f3f4f6') : 'transparent'}
              >
                <span style={{ 
                  width: 24, 
                  height: 24, 
                  borderRadius: 4, 
                  background: displayColor, 
                  color: 'white', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  fontSize: 10,
                  fontWeight: 'bold'
                }}>
                  {getInitials(user.name)}
                </span>
                <span>{user.name}{user.role === 'owner' ? ' 👑' : ''}</span>
                {onlineUser && (
                  <span style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} title={t('online')} />
                )}
              </button>
            );})}
          </div>
        </div>
      )}

      {/* Shortcuts Panel */}
      {showShortcuts && (
        <ShortcutsPanel
          onClose={() => setShowShortcuts(false)}
          darkMode={darkMode}
        />
      )}
      
      {/* Stats Panel */}
      {showStats && (
        <StatsPanel
          stats={stats}
          elements={elements}
          onClose={() => setShowStats(false)}
          darkMode={darkMode}
        />
      )}
      
      {/* Rename Character Modal */}
      {showRenameChar && (
        <RenameCharacterModal
          characters={extractedCharacters}
          onRename={renameCharacter}
          onClose={() => setShowRenameChar(false)}
          darkMode={darkMode}
          t={t}
        />
      )}
      
      {/* Go To Scene Modal */}
      {showGoToScene && (
        <GoToSceneModal
          onClose={() => setShowGoToScene(false)}
          onGoTo={navigateToSceneByNumber}
          maxScene={outline.length}
          darkMode={darkMode}
        />
      )}
      
      {/* Context Action Menu - Google Docs style */}
      {/* Shows when script has focus OR when there's a text selection */}
      {canComment && (scriptHasFocus || textSelection || selectedRange) && contextMenuTop !== null && (() => {
        const hasSelection = textSelection && textSelection.text;
        const currentElement = elements[activeIndex];
        
        // Calculate horizontal position - overlay on script edge
        // Script is 210mm wide, centered in viewport
        const scriptWidth = 793; // 210mm in pixels approx
        const viewportCenter = window.innerWidth / 2;
        const outlineOffset = showOutline ? 175 : 0; // Half of outline width (350/2)
        const commentsOffset = showComments ? 160 : 0; // Half of comments width (320/2)
        const scriptCenter = viewportCenter + outlineOffset - commentsOffset;
        const scriptRightEdge = scriptCenter + (scriptWidth / 2);
        const menuRight = window.innerWidth - scriptRightEdge + 8; // 8px inside the edge
        
        // Clamp Y position to viewport
        const clampedTop = Math.max(80, Math.min(window.innerHeight - 120, contextMenuTop));
        
        return (
        <div 
          className="context-action-menu"
          style={{
            position: 'fixed',
            right: Math.max(showComments ? 340 : 20, menuRight),
            top: clampedTop,
            transform: 'translateY(-50%)',
            display: 'flex',
            flexDirection: 'column',
            gap: 0,
            zIndex: 1000,
            background: 'white',
            borderRadius: 24,
            boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
            padding: 6,
            border: '1px solid #e0e0e0'
          }}
        >
          {/* Suggestion button */}
          <button 
            onClick={() => {
              if (hasSelection) {
                setPendingSuggestion({
                  elementId: textSelection.elementId,
                  elementIndex: textSelection.elementIndex,
                  originalText: textSelection.text,
                  startOffset: textSelection.startOffset,
                  endOffset: textSelection.endOffset
                });
              } else {
                // Suggest on entire element
                setPendingSuggestion({
                  elementId: currentElement?.id,
                  elementIndex: activeIndex,
                  originalText: stripHtml(currentElement?.content) || '',
                  startOffset: 0,
                  endOffset: stripHtml(currentElement?.content).length || 0
                });
              }
              setShowComments(true);
              setTextSelection(null);
            }}
            className="floating-action-btn"
            data-tooltip={t('suggest')}
            style={{
              width: 36,
              height: 36,
              background: 'transparent',
              border: 'none',
              borderRadius: 18,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background 0.15s ease'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f1f3f4'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5f6368" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          
          {/* Comment button */}
          <button
            onClick={() => {
              if (selectedRange) {
                // Multi-block comment: build spans for all selected elements
                const { start, end } = selectedRange;
                const spans = [];
                let fullText = '';
                for (let i = start; i <= end; i++) {
                  const el = elements[i];
                  if (!el) continue;
                  const plain = stripHtml(el.content);
                  spans.push({
                    elementId: el.id,
                    elementIndex: i,
                    startOffset: 0,
                    endOffset: plain.length
                  });
                  if (fullText) fullText += '\n';
                  fullText += plain;
                }
                setPendingInlineComment({
                  elementId: elements[start]?.id,
                  elementIndex: start,
                  text: fullText,
                  startOffset: 0,
                  endOffset: stripHtml(elements[start]?.content).length || 0,
                  spans
                });
                setSelectedRange(null);
              } else if (hasSelection) {
                setPendingInlineComment({
                  elementId: textSelection.elementId,
                  elementIndex: textSelection.elementIndex,
                  text: textSelection.text,
                  startOffset: textSelection.startOffset,
                  endOffset: textSelection.endOffset
                });
              } else {
                // Comment on entire element
                setPendingInlineComment({
                  elementId: currentElement?.id,
                  elementIndex: activeIndex,
                  text: stripHtml(currentElement?.content) || '',
                  startOffset: 0,
                  endOffset: stripHtml(currentElement?.content).length || 0
                });
              }
              setShowComments(true);
              setTextSelection(null);
            }}
            className="floating-action-btn"
            data-tooltip={t('comment')}
            style={{
              width: 36,
              height: 36,
              background: 'transparent',
              border: 'none',
              borderRadius: 18,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background 0.15s ease'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f1f3f4'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5f6368" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              <line x1="12" y1="8" x2="12" y2="14" />
              <line x1="9" y1="11" x2="15" y2="11" />
            </svg>
          </button>
          
          {/* AI Rewrite button */}
          <button 
            onClick={() => {
              if (hasSelection) {
                setAiRewriteSelection({
                  elementId: textSelection.elementId,
                  elementIndex: textSelection.elementIndex,
                  text: textSelection.text,
                  startOffset: textSelection.startOffset,
                  endOffset: textSelection.endOffset
                });
              } else {
                // AI on entire element
                setAiRewriteSelection({
                  elementId: currentElement?.id,
                  elementIndex: activeIndex,
                  text: stripHtml(currentElement?.content) || '',
                  startOffset: 0,
                  endOffset: stripHtml(currentElement?.content).length || 0
                });
              }
              setShowAIRewrite(true);
              setAiRewriteMode(null);
              setAiRewriteResult(null);
              setTextSelection(null);
            }}
            className="floating-action-btn"
            data-tooltip={t('rewriteWithAI')}
            style={{
              width: 36,
              height: 36,
              background: 'transparent',
              border: 'none',
              borderRadius: 18,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background 0.15s ease'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f1f3f4'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5f6368" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </button>
        </div>
        );
      })()}

      {/* AI Rewrite Modal */}
      {showAIRewrite && aiRewriteSelection && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100
        }}
        onClick={(e) => { if (e.target === e.currentTarget) { setShowAIRewrite(false); setAiRewriteSelection(null); setAiRewriteResult(null); setAiRewriteMode(null); } }}
        >
          <div style={{
            background: darkMode ? '#333333' : 'white',
            borderRadius: 16,
            padding: 24,
            width: '100%',
            maxWidth: 500,
            maxHeight: '80vh',
            overflow: 'auto',
            boxShadow: '0 25px 50px rgba(0,0,0,0.4)'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 18, color: darkMode ? 'white' : '#333333', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#6b7280', fontWeight: 700 }}>IA</span> Réécrire avec l'IA
              </h3>
              <button 
                onClick={() => { setShowAIRewrite(false); setAiRewriteSelection(null); setAiRewriteResult(null); setAiRewriteMode(null); }}
                style={{ background: 'none', border: 'none', fontSize: 20, color: darkMode ? '#9ca3af' : '#6b7280', cursor: 'pointer' }}
              >✕</button>
            </div>
            
            {/* Original text */}
            <div style={{ 
              background: darkMode ? '#484848' : '#f3f4f6', 
              padding: 12, 
              borderRadius: 8, 
              marginBottom: 16,
              fontSize: 13,
              color: darkMode ? '#d1d5db' : '#555555',
              fontStyle: 'italic',
              borderLeft: '3px solid #3b82f6'
            }}>
              <div style={{ fontSize: 10, textTransform: 'uppercase', color: '#3b82f6', marginBottom: 6, fontWeight: 600 }}>Texte sélectionné</div>
              "{aiRewriteSelection.text}"
            </div>
            
            {/* Mode selection - only show if no result yet */}
            {!aiRewriteResult && !aiRewriteLoading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 12, color: darkMode ? '#9ca3af' : '#6b7280', marginBottom: 4 }}>Que voulez-vous faire ?</div>
                
                <button 
                  onClick={() => { setAiRewriteMode('concis'); handleAIRewrite('concis'); }}
                  style={{
                    padding: '12px 16px',
                    background: darkMode ? '#484848' : '#f9fafb',
                    border: `1px solid ${darkMode ? '#555555' : '#e5e7eb'}`,
                    borderRadius: 8,
                    color: darkMode ? 'white' : '#333333',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: 14,
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = darkMode ? '#555555' : '#f3f4f6'; e.currentTarget.style.borderColor = '#3b82f6'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = darkMode ? '#484848' : '#f9fafb'; e.currentTarget.style.borderColor = darkMode ? '#555555' : '#e5e7eb'; }}
                >
                  <span style={{ marginRight: 8, display: 'inline-flex' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg></span> <strong>Plus concis</strong>
                  <div style={{ fontSize: 11, color: darkMode ? '#9ca3af' : '#6b7280', marginTop: 2 }}>Raccourcir et aller à l'essentiel</div>
                </button>
                
                <button 
                  onClick={() => { setAiRewriteMode('develop'); handleAIRewrite('develop'); }}
                  style={{
                    padding: '12px 16px',
                    background: darkMode ? '#484848' : '#f9fafb',
                    border: `1px solid ${darkMode ? '#555555' : '#e5e7eb'}`,
                    borderRadius: 8,
                    color: darkMode ? 'white' : '#333333',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: 14,
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = darkMode ? '#555555' : '#f3f4f6'; e.currentTarget.style.borderColor = '#3b82f6'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = darkMode ? '#484848' : '#f9fafb'; e.currentTarget.style.borderColor = darkMode ? '#555555' : '#e5e7eb'; }}
                >
                  <span style={{ marginRight: 8, display: 'inline-flex' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></span> <strong>Développer</strong>
                  <div style={{ fontSize: 11, color: darkMode ? '#9ca3af' : '#6b7280', marginTop: 2 }}>Enrichir avec plus de détails</div>
                </button>
                
                <button 
                  onClick={() => { setAiRewriteMode('reformulate'); handleAIRewrite('reformulate'); }}
                  style={{
                    padding: '12px 16px',
                    background: darkMode ? '#484848' : '#f9fafb',
                    border: `1px solid ${darkMode ? '#555555' : '#e5e7eb'}`,
                    borderRadius: 8,
                    color: darkMode ? 'white' : '#333333',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: 14,
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = darkMode ? '#555555' : '#f3f4f6'; e.currentTarget.style.borderColor = '#3b82f6'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = darkMode ? '#484848' : '#f9fafb'; e.currentTarget.style.borderColor = darkMode ? '#555555' : '#e5e7eb'; }}
                >
                  <span style={{ marginRight: 8, display: 'inline-flex' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg></span> <strong>Reformuler</strong>
                  <div style={{ fontSize: 11, color: darkMode ? '#9ca3af' : '#6b7280', marginTop: 2 }}>Dire la même chose autrement</div>
                </button>
                
                {/* Tone selector */}
                <div style={{
                  padding: '12px 16px',
                  background: darkMode ? '#484848' : '#f9fafb',
                  border: `1px solid ${darkMode ? '#555555' : '#e5e7eb'}`,
                  borderRadius: 8,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ marginRight: 8 }}>🎭</span> <strong style={{ color: darkMode ? 'white' : '#333333', fontSize: 14 }}>Changer le ton</strong>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {['dramatique', 'comique', 'poétique', 'tendu', 'mélancolique', 'cynique'].map(tone => (
                      <button 
                        key={tone}
                        onClick={() => { setAiRewriteTone(tone); setAiRewriteMode('tone'); handleAIRewrite('tone'); }}
                        style={{
                          padding: '6px 12px',
                          background: darkMode ? '#333333' : 'white',
                          border: `1px solid ${darkMode ? '#6b7280' : '#d1d5db'}`,
                          borderRadius: 16,
                          color: darkMode ? '#d1d5db' : '#555555',
                          cursor: 'pointer',
                          fontSize: 12,
                          transition: 'all 0.15s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#3b82f6'; e.currentTarget.style.color = 'white'; e.currentTarget.style.borderColor = '#3b82f6'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = darkMode ? '#333333' : 'white'; e.currentTarget.style.color = darkMode ? '#d1d5db' : '#555555'; e.currentTarget.style.borderColor = darkMode ? '#6b7280' : '#d1d5db'; }}
                      >
                        {tone}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Custom prompt */}
                <div style={{
                  padding: '12px 16px',
                  background: darkMode ? '#484848' : '#f9fafb',
                  border: `1px solid ${darkMode ? '#555555' : '#e5e7eb'}`,
                  borderRadius: 8,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ marginRight: 8 }}>✍️</span> <strong style={{ color: darkMode ? 'white' : '#333333', fontSize: 14 }}>Instruction libre</strong>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input 
                      type="text"
                      value={aiRewriteCustomPrompt}
                      onChange={e => setAiRewriteCustomPrompt(e.target.value)}
                      placeholder="Ex: Rends ce dialogue plus naturel..."
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        background: darkMode ? '#333333' : 'white',
                        border: `1px solid ${darkMode ? '#6b7280' : '#d1d5db'}`,
                        borderRadius: 6,
                        color: darkMode ? 'white' : '#333333',
                        fontSize: 13
                      }}
                      onKeyDown={e => { if (e.key === 'Enter' && aiRewriteCustomPrompt.trim()) { setAiRewriteMode('custom'); handleAIRewrite('custom', aiRewriteCustomPrompt); } }}
                    />
                    <button 
                      onClick={() => { if (aiRewriteCustomPrompt.trim()) { setAiRewriteMode('custom'); handleAIRewrite('custom', aiRewriteCustomPrompt); } }}
                      disabled={!aiRewriteCustomPrompt.trim()}
                      style={{
                        padding: '8px 16px',
                        background: aiRewriteCustomPrompt.trim() ? '#3b82f6' : (darkMode ? '#555555' : '#e5e7eb'),
                        border: 'none',
                        borderRadius: 6,
                        color: aiRewriteCustomPrompt.trim() ? 'white' : (darkMode ? '#9ca3af' : '#9ca3af'),
                        cursor: aiRewriteCustomPrompt.trim() ? 'pointer' : 'not-allowed',
                        fontSize: 13,
                        fontWeight: 500
                      }}
                    >
                      Go
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Loading state */}
            {aiRewriteLoading && (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <div style={{ 
                  width: 40, 
                  height: 40, 
                  border: '3px solid transparent',
                  borderTopColor: '#3b82f6',
                  borderRadius: '50%',
                  margin: '0 auto 16px',
                  animation: 'spin 1s linear infinite'
                }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                <div style={{ color: darkMode ? '#9ca3af' : '#6b7280', fontSize: 14 }}>L'IA réfléchit...</div>
              </div>
            )}
            
            {/* Result */}
            {aiRewriteResult && !aiRewriteLoading && (
              <div>
                <div style={{ 
                  background: aiRewriteResult.startsWith('❌') ? (darkMode ? '#7f1d1d' : '#fef2f2') : (darkMode ? '#4a4a4a' : '#eff6ff'), 
                  padding: 16, 
                  borderRadius: 8, 
                  marginBottom: 16,
                  borderLeft: `3px solid ${aiRewriteResult.startsWith('❌') ? '#ef4444' : '#3b82f6'}`
                }}>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', color: aiRewriteResult.startsWith('❌') ? '#ef4444' : '#3b82f6', marginBottom: 8, fontWeight: 600 }}>
                    {aiRewriteResult.startsWith('❌') ? 'Erreur' : 'Proposition de l\'IA'}
                  </div>
                  <div style={{ 
                    color: darkMode ? 'white' : '#333333', 
                    fontSize: 14,
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap'
                  }}>
                    {aiRewriteResult}
                  </div>
                </div>
                
                {/* Actions */}
                {!aiRewriteResult.startsWith('❌') && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button 
                      onClick={applyAIRewrite}
                      style={{
                        flex: 1,
                        padding: '12px 16px',
                        background: '#22c55e',
                        border: 'none',
                        borderRadius: 8,
                        color: 'white',
                        cursor: 'pointer',
                        fontSize: 14,
                        fontWeight: 600
                      }}
                    >
                      ✓ Appliquer
                    </button>
                    <button 
                      onClick={() => handleAIRewrite(aiRewriteMode, aiRewriteMode === 'custom' ? aiRewriteCustomPrompt : '')}
                      style={{
                        padding: '12px 16px',
                        background: darkMode ? '#484848' : '#f3f4f6',
                        border: `1px solid ${darkMode ? '#555555' : '#d1d5db'}`,
                        borderRadius: 8,
                        color: darkMode ? 'white' : '#333333',
                        cursor: 'pointer',
                        fontSize: 14
                      }}
                    >
                      🔄 Régénérer
                    </button>
                    <button 
                      onClick={() => { setAiRewriteResult(null); setAiRewriteMode(null); }}
                      style={{
                        padding: '12px 16px',
                        background: 'transparent',
                        border: `1px solid ${darkMode ? '#555555' : '#d1d5db'}`,
                        borderRadius: 8,
                        color: darkMode ? '#9ca3af' : '#6b7280',
                        cursor: 'pointer',
                        fontSize: 14
                      }}
                    >
                      ← Retour
                    </button>
                  </div>
                )}
                
                {aiRewriteResult.startsWith('❌') && (
                  <button 
                    onClick={() => { setAiRewriteResult(null); setAiRewriteMode(null); }}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      background: darkMode ? '#484848' : '#f3f4f6',
                      border: `1px solid ${darkMode ? '#555555' : '#d1d5db'}`,
                      borderRadius: 8,
                      color: darkMode ? 'white' : '#333333',
                      cursor: 'pointer',
                      fontSize: 14
                    }}
                  >
                    ← Réessayer
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Drag overlay - prevents blue selection during panel drag */}
      {isDraggingAny && (
        <div style={{ 
          position: 'fixed', 
          inset: 0, 
          zIndex: 150, 
          cursor: 'grabbing',
          background: 'transparent'
        }} />
      )}
      
      {/* Chat Panel - FLOATING */}
      {showChat && (
        <div 
          style={{
            position: 'fixed',
            left: chatPosition.x,
            top: chatPosition.y,
            width: 320,
            height: 450,
            background: darkMode ? '#333333' : 'white',
            border: `1px solid ${darkMode ? '#484848' : '#d1d5db'}`,
            borderRadius: 12,
            display: 'flex',
            flexDirection: 'column',
            zIndex: 200,
            boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
            resize: 'both',
            overflow: 'hidden'
          }}
        >
          {/* Chat Header - DRAGGABLE */}
          <div 
            style={{ 
              padding: '12px 16px', 
              borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'move',
              background: darkMode ? '#484848' : '#f3f4f6',
              borderRadius: '12px 12px 0 0',
              userSelect: 'none'
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              if (e.target.tagName === 'BUTTON') return;
              setIsDraggingChat(true);
              dragOffsetRef.current = { x: e.clientX - chatPosition.x, y: e.clientY - chatPosition.y };
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: 14, color: darkMode ? 'white' : 'black', display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                Chat
              </h3>
              <span style={{ fontSize: 10, color: '#6b7280' }}>{users.length} connecté{users.length > 1 ? 's' : ''}</span>
            </div>
            <button 
              onClick={() => setShowChat(false)} 
              style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 16 }}
            >✕</button>
          </div>
          
          {/* Online Users */}
          <div style={{ 
            padding: '6px 12px', 
            borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`,
            display: 'flex',
            gap: 6,
            overflowX: 'auto',
            flexShrink: 0
          }}>
            {users.map(user => (
              <div 
                key={user.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '3px 6px',
                  background: darkMode ? '#484848' : '#f3f4f6',
                  borderRadius: 10,
                  fontSize: 10,
                  whiteSpace: 'nowrap'
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: user.color || '#22c55e' }} />
                <span style={{ color: darkMode ? 'white' : 'black' }}>
                  {user.name}{user.id === myId ? ' (vous)' : ''}
                </span>
              </div>
            ))}
          </div>
          
          {/* Messages */}
          <div style={{ 
            flex: 1, 
            overflow: 'auto', 
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 10
          }}>
            {chatMessages.length === 0 ? (
              <p style={{ color: '#6b7280', textAlign: 'center', marginTop: 30, fontSize: 12 }}>
                Aucun message.<br/>Commencez la conversation !
              </p>
            ) : (
              chatMessages.map(msg => (
                <div 
                  key={msg.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: msg.senderId === myId ? 'flex-end' : 'flex-start'
                  }}
                >
                  {msg.senderId !== myId && (
                    <span style={{ fontSize: 9, color: msg.senderColor || '#6b7280', marginBottom: 1, fontWeight: 'bold' }}>
                      {msg.senderName}
                    </span>
                  )}
                  <div style={{
                    background: msg.senderId === myId ? '#3b82f6' : (darkMode ? '#484848' : '#f3f4f6'),
                    color: msg.senderId === myId ? 'white' : (darkMode ? 'white' : 'black'),
                    padding: '6px 10px',
                    borderRadius: 10,
                    maxWidth: '85%',
                    fontSize: 12,
                    lineHeight: 1.3,
                    wordBreak: 'break-word'
                  }}>
                    {msg.content}
                  </div>
                  <span style={{ fontSize: 8, color: '#6b7280', marginTop: 1 }}>
                    {new Date(msg.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>
          
          {/* Input */}
          <div style={{ 
            padding: 10, 
            borderTop: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`,
            display: 'flex',
            gap: 6,
            flexShrink: 0
          }}>
            <input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendChatMessage()}
              placeholder="Message..."
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 16,
                border: `1px solid ${darkMode ? '#555555' : '#d1d5db'}`,
                background: darkMode ? '#484848' : 'white',
                color: darkMode ? 'white' : 'black',
                fontSize: 12,
                outline: 'none'
              }}
            />
            <button
              onClick={sendChatMessage}
              disabled={!chatInput.trim()}
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                border: 'none',
                background: chatInput.trim() ? '#3b82f6' : (darkMode ? '#484848' : '#e5e7eb'),
                color: chatInput.trim() ? 'white' : '#9ca3af',
                cursor: chatInput.trim() ? 'pointer' : 'default',
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              ➤
            </button>
          </div>
        </div>
      )}
      
      {/* Writing Timer Widget - FLOATING */}
      {showTimer && (
        timerCompact ? (
          /* COMPACT MODE */
          <div style={{
            position: 'fixed',
            left: timerPosition.x,
            top: timerPosition.y,
            background: darkMode ? '#333333' : 'white',
            border: `1px solid ${darkMode ? '#484848' : '#d1d5db'}`,
            borderRadius: 10,
            boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
            zIndex: 200,
            overflow: 'hidden'
          }}>
            <div 
              style={{ 
                padding: '8px 12px', 
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                cursor: 'grab',
                background: darkMode ? '#484848' : '#f3f4f6'
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                dragOffsetRef.current = { x: e.clientX - timerPosition.x, y: e.clientY - timerPosition.y };
                setIsDraggingTimer(true);
              }}
            >
              {/* Time display */}
              <span style={{ 
                fontSize: 18, 
                fontWeight: 'bold', 
                fontFamily: 'monospace', 
                color: timerMode === 'sprint' && sprintTimeLeft < 60 ? '#ef4444' : (darkMode ? 'white' : 'black'),
                minWidth: 60
              }}>
                {timerMode === 'chrono' ? formatTime(timerSeconds) : formatTime(sprintTimeLeft)}
              </span>
              
              {/* Play/Pause */}
              <button 
                onClick={() => setTimerRunning(!timerRunning)}
                style={{ 
                  width: 28, height: 28,
                  background: timerRunning ? '#ef4444' : '#22c55e', 
                  border: 'none', 
                  borderRadius: 6, 
                  color: 'white', 
                  cursor: 'pointer', 
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {timerRunning ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                )}
              </button>
              
              {/* Reset */}
              <button 
                onClick={resetTimer}
                style={{ 
                  width: 28, height: 28,
                  background: darkMode ? '#555555' : '#e5e7eb', 
                  border: 'none', 
                  borderRadius: 6, 
                  color: darkMode ? 'white' : '#484848', 
                  cursor: 'pointer', 
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
              </button>
              
              {/* Expand */}
              <button 
                onClick={() => setTimerCompact(false)}
                style={{ 
                  width: 28, height: 28,
                  background: 'transparent', 
                  border: 'none', 
                  color: '#6b7280', 
                  cursor: 'pointer', 
                  fontSize: 14,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title="Agrandir"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
              </button>
              
              {/* Close */}
              <button 
                onClick={() => setShowTimer(false)} 
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: '#6b7280', 
                  cursor: 'pointer', 
                  fontSize: 12,
                  marginLeft: -4
                }}
              >
                ✕
              </button>
            </div>
          </div>
        ) : (
          /* EXPANDED MODE */
          <div style={{
            position: 'fixed',
            left: timerPosition.x,
            top: timerPosition.y,
            background: darkMode ? '#333333' : 'white',
            border: `1px solid ${darkMode ? '#484848' : '#d1d5db'}`,
            borderRadius: 12,
            boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
            zIndex: 200,
            minWidth: 220,
            overflow: 'hidden'
          }}>
            {/* Timer Header - DRAGGABLE */}
            <div 
              style={{ 
                padding: '10px 16px', 
                borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'grab',
                background: darkMode ? '#484848' : '#f3f4f6'
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                dragOffsetRef.current = { x: e.clientX - timerPosition.x, y: e.clientY - timerPosition.y };
                setIsDraggingTimer(true);
              }}
            >
              <span style={{ fontSize: 12, color: darkMode ? 'white' : '#484848', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>Timer</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button 
                  onClick={() => setTimerCompact(true)} 
                  style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center' }}
                  title="Réduire"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
                </button>
                <button onClick={() => setShowTimer(false)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
              </div>
            </div>
            
            <div style={{ padding: 16 }}>
              {/* Mode selector */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 12, background: darkMode ? '#484848' : '#e5e7eb', borderRadius: 6, padding: 3 }}>
                <button 
                  onClick={() => { setTimerMode('chrono'); if (!timerRunning) resetTimer(); }}
                  style={{ 
                    flex: 1, 
                    padding: '6px 10px', 
                    background: timerMode === 'chrono' ? (darkMode ? '#333333' : 'white') : 'transparent', 
                    border: 'none', 
                    borderRadius: 4, 
                    color: timerMode === 'chrono' ? (darkMode ? 'white' : 'black') : '#6b7280', 
                    cursor: 'pointer', 
                    fontSize: 11,
                    fontWeight: timerMode === 'chrono' ? 600 : 400,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  Chrono
                </button>
                <button 
                  onClick={() => { setTimerMode('sprint'); if (!timerRunning) { resetTimer(); setSprintTimeLeft(sprintDuration); } }}
                  style={{ 
                    flex: 1, 
                    padding: '6px 10px', 
                    background: timerMode === 'sprint' ? (darkMode ? '#333333' : 'white') : 'transparent', 
                    border: 'none', 
                    borderRadius: 4, 
                    color: timerMode === 'sprint' ? (darkMode ? 'white' : 'black') : '#6b7280', 
                    cursor: 'pointer', 
                    fontSize: 11,
                    fontWeight: timerMode === 'sprint' ? 600 : 400,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                  Sprint
                </button>
              </div>
              
              {/* Timer display */}
              <div style={{ fontSize: 32, fontWeight: 'bold', fontFamily: 'monospace', textAlign: 'center', color: timerMode === 'sprint' && sprintTimeLeft < 60 ? '#ef4444' : (darkMode ? 'white' : 'black'), marginBottom: 8 }}>
                {timerMode === 'chrono' ? formatTime(timerSeconds) : formatTime(sprintTimeLeft)}
              </div>
              
              {/* Sprint duration selector */}
              {timerMode === 'sprint' && !timerRunning && (
                <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginBottom: 12 }}>
                  {[15, 25, 45, 60].map(mins => (
                    <button 
                      key={mins}
                      onClick={() => setSprintMinutes(mins)}
                      style={{ 
                        padding: '4px 8px', 
                        background: sprintDuration === mins * 60 ? '#3b82f6' : (darkMode ? '#484848' : '#e5e7eb'), 
                        border: 'none', 
                        borderRadius: 4, 
                        color: sprintDuration === mins * 60 ? 'white' : (darkMode ? '#d1d5db' : '#484848'), 
                        cursor: 'pointer', 
                        fontSize: 10 
                      }}
                    >
                      {mins}m
                    </button>
                  ))}
                </div>
              )}
              
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 12 }}>
                <button 
                  onClick={() => setTimerRunning(!timerRunning)}
                  style={{ 
                    padding: '8px 16px', 
                    background: timerRunning ? '#ef4444' : '#22c55e', 
                    border: 'none', 
                    borderRadius: 6, 
                    color: 'white', 
                    cursor: 'pointer', 
                    fontSize: 13,
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  {timerRunning ? (
                    <><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>Pause</>
                  ) : (
                    <><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>Start</>
                  )}
                </button>
                <button 
                  onClick={resetTimer}
                  style={{ 
                    padding: '8px 12px', 
                    background: darkMode ? '#484848' : '#e5e7eb', 
                    border: 'none', 
                    borderRadius: 6, 
                    color: darkMode ? 'white' : 'black', 
                    cursor: 'pointer', 
                    fontSize: 13,
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
                </button>
              </div>
              <div style={{ borderTop: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, paddingTop: 12, fontSize: 12, color: '#6b7280' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>Mots cette session</span>
                  <span style={{ color: sessionWordCount > 0 ? '#22c55e' : (darkMode ? 'white' : 'black'), fontWeight: 500 }}>+{sessionWordCount}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Mots/heure</span>
                  <span style={{ color: darkMode ? 'white' : 'black' }}>{timerSeconds > 60 ? Math.round(sessionWordCount / (timerSeconds / 3600)) : '—'}</span>
                </div>
              </div>
              
              {/* Daily Goal Section */}
              <div style={{ borderTop: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, paddingTop: 12, marginTop: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>Objectif du jour</span>
                  <span style={{ fontSize: 11, color: writingGoal.todayWords >= writingGoal.daily ? '#22c55e' : (darkMode ? 'white' : '#484848') }}>
                    {writingGoal.todayWords} / {writingGoal.daily}
                  </span>
                </div>
                <div style={{ height: 6, background: darkMode ? '#484848' : '#e5e7eb', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
                  <div style={{ 
                    height: '100%', 
                    width: `${Math.min(100, Math.round((writingGoal.todayWords / writingGoal.daily) * 100))}%`, 
                    background: writingGoal.todayWords >= writingGoal.daily ? '#22c55e' : '#3b82f6', 
                    borderRadius: 3, 
                    transition: 'width 0.3s' 
                  }} />
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[500, 1000, 1500, 2000].map(preset => (
                    <button
                      key={preset}
                      onClick={() => setWritingGoal(g => ({ ...g, daily: preset }))}
                      style={{ 
                        flex: 1, 
                        padding: '4px', 
                        background: writingGoal.daily === preset ? '#3b82f6' : (darkMode ? '#484848' : '#e5e7eb'), 
                        border: 'none', 
                        borderRadius: 4, 
                        color: writingGoal.daily === preset ? 'white' : (darkMode ? '#9ca3af' : '#6b7280'), 
                        cursor: 'pointer', 
                        fontSize: 9 
                      }}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )
      )}
      
      {/* CSS Highlight API styles for comments and suggestions */}
      <style>{`
        ::highlight(comment-highlight) {
          background-color: rgba(251, 191, 36, 0.4);
          border-radius: 2px;
        }
        ::highlight(suggestion-highlight) {
          background-color: rgba(34, 197, 94, 0.3);
          text-decoration: underline wavy #16a34a;
        }
        
        /* Reduce paint complexity on Safari */
        @supports (-webkit-touch-callout: none) {
          .comments-sidebar-card {
            -webkit-transform: translateZ(0);
            transform: translateZ(0);
            contain: layout style paint;
          }
          
          /* Force GPU compositing for smooth scrolling */
          .comments-sidebar-scroll-container {
            -webkit-overflow-scrolling: touch;
            transform: translateZ(0);
          }
          
          /* Reduce repaints during scroll */
          .script-container {
            -webkit-overflow-scrolling: touch;
            transform: translateZ(0);
          }
          
          /* Disable animations on Safari for better perf */
          * {
            scroll-behavior: auto !important;
          }
        }
        
        /* Custom Tooltips */
        .header-btn {
          position: relative;
        }
        .header-btn::after {
          content: attr(data-tooltip);
          position: absolute;
          top: calc(100% + 8px);
          left: 50%;
          transform: translateX(-50%);
          padding: 6px 10px;
          background: ${darkMode ? '#333333' : '#484848'};
          color: white;
          font-size: 11px;
          font-weight: 500;
          white-space: nowrap;
          border-radius: 6px;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.15s ease, transform 0.15s ease;
          z-index: 1000;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }
        .header-btn::before {
          content: '';
          position: absolute;
          top: calc(100% + 2px);
          left: 50%;
          transform: translateX(-50%);
          border: 5px solid transparent;
          border-bottom-color: ${darkMode ? '#333333' : '#484848'};
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.15s ease;
          z-index: 1000;
        }
        .header-btn:hover::after,
        .header-btn:hover::before {
          opacity: 1;
        }
        .header-btn:hover::after {
          transform: translateX(-50%) translateY(0);
        }
        
        /* Outline tooltips - appear above */
        .outline-btn {
          position: relative;
        }
        .outline-btn::after {
          content: attr(data-tooltip);
          position: absolute;
          bottom: calc(100% + 6px);
          left: 50%;
          transform: translateX(-50%);
          padding: 5px 8px;
          background: ${darkMode ? '#333333' : '#484848'};
          color: white;
          font-size: 10px;
          font-weight: 500;
          white-space: nowrap;
          border-radius: 4px;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.15s ease;
          z-index: 1000;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        }
        .outline-btn::before {
          content: '';
          position: absolute;
          bottom: calc(100% + 1px);
          left: 50%;
          transform: translateX(-50%);
          border: 4px solid transparent;
          border-top-color: ${darkMode ? '#333333' : '#484848'};
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.15s ease;
          z-index: 1000;
        }
        .outline-btn:hover::after,
        .outline-btn:hover::before {
          opacity: 1;
        }
        
        /* Floating action buttons tooltips (Google Docs style - appears on LEFT) */
        .floating-action-btn {
          position: relative;
        }
        .floating-action-btn::after {
          content: attr(data-tooltip);
          position: absolute;
          right: calc(100% + 8px);
          top: 50%;
          transform: translateY(-50%);
          padding: 6px 10px;
          background: #202124;
          color: white;
          font-size: 11px;
          font-weight: 500;
          white-space: nowrap;
          border-radius: 4px;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.15s ease;
          z-index: 1001;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        }
        .floating-action-btn::before {
          content: '';
          position: absolute;
          right: calc(100% + 2px);
          top: 50%;
          transform: translateY(-50%);
          border: 5px solid transparent;
          border-left-color: #202124;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.15s ease;
          z-index: 1001;
        }
        .floating-action-btn:hover::after,
        .floating-action-btn:hover::before {
          opacity: 1;
        }
      `}</style>
      
      {/* Focus Mode Overlay - dims everything except current element */}
      {focusMode && (
        <style>{`
          .focus-mode-active [data-element-id]:not([data-element-id="${elements[activeIndex]?.id}"]) {
            opacity: 0.3 !important;
            transition: opacity 0.3s ease;
          }
          .focus-mode-active [data-element-id="${elements[activeIndex]?.id}"] {
            opacity: 1 !important;
          }
        `}</style>
      )}
    </div>
  );
}
