import { createContext } from 'react';

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

    // Cloud sync (desktop)
    cloudBadge: "En ligne",
    localBadge: "Local",
    switchToLocal: "← Local",
    switchToCloud: "→ Cloud",
    lastSynced: "Sync",
    publishToCloud: "Publier en ligne",
    pushToCloudBtn: "↑ Envoyer vers le cloud",
    pullFromCloudBtn: "↓ Récupérer du cloud",
    syncInProgress: "Synchronisation...",
    pushWarning: "La version en ligne sera remplacée par votre version locale.",
    pullWarning: "Votre version locale sera remplacée par la version en ligne.",
    cloudAuthRequired: "Connectez-vous au cloud pour partager",
    cloudConnection: "Connexion Cloud",
    cloudAccount: "Compte cloud",
    cloudLogout: "Déconnexion cloud",
    confirm: "Confirmer",
    cloudLinkLabel: "Lien de partage cloud :",
    publishSuccess: "Document publié en ligne !",

    // BeatBoard
    gridView: "Grille",
    canvasView: "Canvas",
    drawView: "Dessin",
    card: "Carte",
    liveMode: "Synchronisation automatique avec le script",
    stagingMode: "Mode brouillon",
    draft: "Brouillon",
    applyToScript: "Appliquer au script",
    exportSVG: "Exporter en SVG",
    allScenes: "Toutes les scènes",
    uncutScenes: "Hors montage",
    notes: "Notes",
    noUncutScenes: "Aucune scène hors montage",
    noScenes: "Aucune scène",
    showStrip: "Afficher la bande",
    hideStrip: "Masquer la bande",
    emptyTimeline: "Aucune scène dans le montage",
    sceneLinked: "Scène (liée au script)",
    titleFromScript: "Le titre vient du script. Modifiez-le dans l'éditeur.",
    sceneSummary: "Résumé de la scène",
    synopsisPlaceholder: "Décrivez cette scène en une phrase...",
    montage: "Montage",
    color: "Couleur",
    convertTo: "Convertir en :",
    loadingWhiteboard: "Chargement du whiteboard...",
    whiteboardInstructions: "Dessinez librement • Sélectionnez une forme pour la convertir en carte",
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

    // Cloud sync (desktop)
    cloudBadge: "Online",
    localBadge: "Local",
    switchToLocal: "← Local",
    switchToCloud: "→ Cloud",
    lastSynced: "Sync",
    publishToCloud: "Publish online",
    pushToCloudBtn: "↑ Push to cloud",
    pullFromCloudBtn: "↓ Pull from cloud",
    syncInProgress: "Syncing...",
    pushWarning: "The online version will be replaced by your local version.",
    pullWarning: "Your local version will be replaced by the online version.",
    cloudAuthRequired: "Sign in to cloud to share",
    cloudConnection: "Cloud Sign In",
    cloudAccount: "Cloud account",
    cloudLogout: "Cloud sign out",
    confirm: "Confirm",
    cloudLinkLabel: "Cloud share link:",
    publishSuccess: "Document published online!",

    // BeatBoard
    gridView: "Grid",
    canvasView: "Canvas",
    drawView: "Draw",
    card: "Card",
    liveMode: "Auto-sync with script",
    stagingMode: "Draft mode",
    draft: "Draft",
    applyToScript: "Apply to script",
    exportSVG: "Export SVG",
    allScenes: "All scenes",
    uncutScenes: "Uncut",
    notes: "Notes",
    noUncutScenes: "No uncut scenes",
    noScenes: "No scenes",
    showStrip: "Show strip",
    hideStrip: "Hide strip",
    emptyTimeline: "No scenes in cut",
    sceneLinked: "Scene (linked to script)",
    titleFromScript: "Title comes from the script. Edit it in the script editor.",
    sceneSummary: "Scene summary",
    synopsisPlaceholder: "Describe this scene in one sentence...",
    montage: "Cut",
    color: "Color",
    convertTo: "Convert to:",
    loadingWhiteboard: "Loading whiteboard...",
    whiteboardInstructions: "Draw freely \u2022 Select a shape to convert it to a card",
  }
};

const LanguageContext = createContext({ language: 'fr', t: (key) => key, setLanguage: () => {} });

export { translations, LanguageContext };
