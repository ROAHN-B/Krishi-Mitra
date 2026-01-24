"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
// Assuming these are external contexts and components
import { useLanguage, Language } from "@/contexts/language-context";
import { useAdvisory } from "@/contexts/AdvisoryContext";
import { ChatHistorySidebar } from "./ChatHistorySidebar"; 
import { cn } from "@/lib/utils";

// UI Components
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { 
    Send, 
    Bot, 
    User, 
    Paperclip, 
    Mic, 
    X, 
    LoaderCircle, 
    Sparkles, 
    Languages, 
    Menu,
    AlertTriangle
} from "lucide-react";


// ---------- FIX FOR TYPESCRIPT ERROR (Mandatory for Voice Rec.) ----------
declare global {
    interface Window {
        SpeechRecognition: any;
        webkitSpeechRecognition: any;
    }
}
// ----------------------------------------------------------------------

// ---------- ERROR BOUNDARY (No change) ----------
class ChatbotErrorBoundary extends React.Component<
    { children: React.ReactNode },
    { hasError: boolean; error: Error | null }
> {
    constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="fixed inset-0 z-50 flex bg-background text-foreground items-center justify-center">
                    <div className="text-center p-6 max-w-md">
                        <AlertTriangle className="h-16 w-16 text-destructive mx-auto mb-4" />
                        <h2 className="text-xl font-bold mb-2">Chatbot Error</h2>
                        <p className="text-muted-foreground mb-4 text-sm">
                            {this.state.error?.message || 'Unable to load chat interface'}
                        </p>
                        <Button onClick={() => window.location.reload()}>
                            Reload Chat
                        </Button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

// ---------- TYPES (Updated for multiple videos) ----------
type VideoResult = {
    videoUrl: string; 
    title: string;
};

type Message = {
    role: "user" | "bot";
    text: string;
    html?: string;
    image?: string;
    suggestions?: string[];
    timestamp?: number;
    videos?: VideoResult[]; // Array of video objects
};

type Chat = {
    id: string;
    title: string;
    timestamp: number;
    messages: Message[];
};

type ChatHistory = {
    [id: string]: Chat;
};
// -------------------------------------------------

// ---------- HELPER FUNCTIONS (mdToHtml CORRECTED) ----------
const fileToBase64 = (file: File): Promise<string> => 
    new Promise((resolve, reject) => { 
        const reader = new FileReader(); 
        reader.readAsDataURL(file); 
        reader.onload = () => resolve((reader.result as string).split(",")[1]); 
        reader.onerror = reject; 
    });

// FIX: Changed string replacements to use function replacements 
// to avoid TypeScript implicitly assigning 'any' type to parameters like 'q'.
const mdToHtml = (md: string): string => 
    md.replace(/^## (.*$)/gim, (_match, p1) => `<h2 class='font-bold text-lg mt-4 mb-2 text-foreground'>${p1}</h2>`)
      .replace(/\*\*(.+?)\*\*/g, "<strong class='font-semibold text-foreground'>$1</strong>")
      .replace(/^[\*\-] (.*$)/gim, (_match, p1) => `<li class='ml-4 my-1 list-disc'>${p1}</li>`)
      .replace(/\n/g, "<br />");

const getSafeTranslation = (translations: any, path: string, fallback: any = '') => {
    try {
        const keys = path.split('.');
        let result = translations;
        for (const key of keys) {
            if (result && typeof result === 'object' && key in result) {
                result = result[key];
            } else {
                return fallback;
            }
        }
        return result || fallback;
    } catch (error) {
        console.warn(`Translation missing: ${path}`, error);
        return fallback;
    }
};

const getMultilingualMessages = (lang: Language) => {
    const messages = {
        en: {
            welcome: "🌾 Welcome to Krishi-Mitra! I'm your AI agricultural assistant. How can I help you today?",
            suggestions: ["🌱 What crops are suitable for my region?", "🔍 Help me identify this plant disease", "📅 When should I plant rice?", "💰 What are the current market prices?"]
        },
        hi: {
            welcome: "🌾 कृषिमित्र में आपका स्वागत है! मैं आपका AI कृषि सहायक हूं। मैं आज आपकी कैसे मदद कर सकता हूं?",
            suggestions: ["🌱 मेरे क्षेत्र के लिए कौी फसलें उपयुक्त हैं?", "🔍 इस पौधे की बीमारी की पहचान करने में मेरी सहायता करें", "📅 मुझे चावल कब लगाना चाहिए?", "💰 वर्तमान बाजार भाव क्या हैं?"]
        },
        mr: {
            welcome: "🌾 कृषीमित्रमध्ये आपले स्वागत आहे! मी तुमचा AI शेती सहाय्यक आहे. मी आज तुमची कशी मदत करू शकतो?",
            suggestions: ["🌱 माझ्या भागासाठी कोणते पीक उपयुक्त आहे?", "🔍 या वनस्पती रोगाची ओळख पटवण्यात माझी मदत करा", "📅 मला तांदूळ कधी लावावा?", "💰 सध्याचे बाजार भाव काय आहेत?"]
        },
        pa: {
            welcome: "🌾 ਕ੍ਰਿਸ਼ੀਮਿੱਤਰ ਵਿੱਚ ਤੁਹਾਡਾ ਸਵਾਗਤ ਹੈ! ਮੈਂ ਤੁਹਾਡਾ AI ਖੇਤੀਬਾੜੀ ਸਹਾਇਕ ਹਾਂ। ਮੈਂ ਅੱਜ ਤੁਹਾਡੀ ਕਿਵੇਂ ਮਦਦ ਕਰ ਸਕਦਾ ਹਾਂ?",
            suggestions: ["🌱 ਮੇਰੇ ਖੇਤਰ ਲਈ ਕਿਹੜੀਆਂ ਫਸਲਾਂ ਢੁੱਕਵੀਆਂ ਹਨ?", "🔍 ਮੈਨੂੰ ਇਸ ਪੌਦੇ ਦੀ ਬਿਮਾਰੀ ਦੀ ਪਛਾਣ ਕਰਨ ਵਿੱਚ ਮਦਦ ਕਰੋ", "📅 ਮੈਨੂੰ ਚਾਵਲ ਕਦੋਂ ਲਗਾਉਣੇ ਚਾਹੀਦੇ ਹਨ?", "💰 ਮੌਜੂਦਾ ਬਾਜ਼ਾਰ ਭਾਅ ਕੀ ਹਨ?"]
        },
        kn: {
            welcome: "🌾 ಕೃಷಿಮಿತ್ರಕ್ಕೆ ಸುಸ್ವಾಗತ! ನಾನು ನಿಮ್ಮ AI ಕೃಷಿ ಸಹಾಯಕನಾಗಿದ್ದೇನೆ. ನಾನು ಇಂದು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಬಹುದು?",
            suggestions: ["🌱 ನನ್ನ ಪ್ರದೇಶಕ್ಕೆ ಯಾವ ಬೆಳೆಗಳು ಯೋಗ್ಯವಾಗಿವೆ?", "🔍 ಈ ಸಸ್ಯದ ರೋಗವನ್ನು ಗುರುತಿಸಲು ನನಗೆ ಸಹಾಯ ಮಾಡಿ", "📅 ನಾನು ಅಕ್ಕಿಯನ್ನು ಯಾವಾಗ ನಾಟು ಮಾಡಬೇಕು?", "💰 ಪ್ರಸ್ತುತ ಮಾರುಕಟ್ಟೆ ಬೆಲೆಗಳು ಏನು?"]
        },
        ta: {
            welcome: "🌾 கிருஷிமித்ராவுக்கு வரவேற்கிறேன்! நான் உங்கள் AI விவசாய உதவியாளர். இன்று நான் உங்களுக்கு எவ்வாறு உதவ முடியும்?",
            suggestions: ["🌱 என் பகுதிக்கு எந்த பயிர்கள் ஏற்றவை?", "🔍 இந்த தாவர நோயை அடையாளம் காண எனக்கு உதவுங்கள்", "📅 எனக்கு அரிசி எப்போது நட வேண்டும்?", "💰 தற்போதைய சந்தை விலைகள் என்ன?"]
        }
    };
    return messages[lang] || messages.en;
};


function Speaker({ text, lang }: { text: string; lang: string }) {
    const [speaking, setSpeaking] = useState(false);
    const [isSupported, setIsSupported] = useState(true);

    useEffect(() => {
        const checkSupport = () => {
            const supported = 'speechSynthesis' in window;
            setIsSupported(supported);
        };
        checkSupport();
        return () => {
            if (speechSynthesis) {
                speechSynthesis.cancel();
            }
        };
    }, []);

    const toggle = useCallback(() => {
        if (!isSupported) return;

        if (speaking) {
            speechSynthesis.cancel();
            setSpeaking(false);
            return;
        }

        try {
            const cleanText = text.replace(/<[^>]*>/g, "");
            const utterance = new SpeechSynthesisUtterance(cleanText);
            const voices = speechSynthesis.getVoices();
            const voice = voices.find((v) => v.lang.startsWith(lang)) || 
                          voices.find((v) => v.lang.startsWith(lang.split("-")[0]));
            
            if (voice) utterance.voice = voice;
            utterance.lang = voice?.lang || lang;
            utterance.onend = () => setSpeaking(false);
            utterance.onerror = () => setSpeaking(false);
            
            speechSynthesis.speak(utterance);
            setSpeaking(true);
        } catch (error) {
            console.error('Speech synthesis error:', error);
            setSpeaking(false);
        }
    }, [text, lang, isSupported, speaking]);

    if (!isSupported) return null;

    return (
        <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted" 
            onClick={toggle}
            title="Listen to response"
        >
            {speaking ? <X size={16} /> : <Sparkles size={16} className="text-primary" />}
        </Button>
    );
}

function SuggestionButtons({ suggestions, onSuggestionClick }: { suggestions: string[]; onSuggestionClick: (s: string) => void }) {
    return (
        <div className="w-full mt-3 space-y-2">
            {suggestions.map((suggestion, index) => (
                <button
                    key={index}
                    onClick={() => onSuggestionClick(suggestion)}
                    className="flex items-center gap-2 text-sm bg-card border border-border text-foreground px-4 py-2 rounded-full hover:bg-muted transition-colors shadow-sm w-max"
                >
                    <Sparkles size={16} className="flex-shrink-0 text-primary" />
                    <span>{suggestion}</span>
                </button>
            ))}
        </div>
    );
}


function useVoiceRecognition(lang: Language, onTranscript: (transcript: string) => void) {
    const [isListening, setIsListening] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const recognitionRef = useRef<any>(null);

    const startListening = useCallback(() => {
        if (!window.webkitSpeechRecognition && !window.SpeechRecognition) {
            setError("Voice input is not supported in this browser.");
            return;
        }

        try {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            
            if (!SpeechRecognition) {
                setError("Speech recognition not available.");
                return;
            }

            const recognition = new SpeechRecognition();
            recognitionRef.current = recognition;
            
            const langCode = lang === 'hi' ? 'hi-IN' : 
                             lang === 'mr' ? 'mr-IN' :
                             lang === 'pa' ? 'pa-IN' :
                             lang === 'kn' ? 'kn-IN' :
                             lang === 'ta' ? 'ta-IN' : 'en-US';
            
            recognition.lang = langCode;
            recognition.interimResults = false;
            recognition.continuous = false;
            
            recognition.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript;
                if (transcript) {
                    onTranscript(transcript.trim());
                }
            };
            
            recognition.onerror = (event: any) => {
                setError(`Voice recognition error: ${event.error}`);
                setIsListening(false);
            };
            
            recognition.onend = () => {
                setIsListening(false);
                recognitionRef.current = null;
            };
            
            recognition.start();
            setIsListening(true);
            setError(null);
        } catch (error) {
            console.error('Speech recognition setup error:', error);
            setError("Failed to start voice recognition. Please try again.");
            setIsListening(false);
        }
    }, [lang, onTranscript]);

    const stopListening = useCallback(() => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }
    }, []);

    return { isListening, error, startListening, stopListening };
}


function YouTubePlayer({ videos }: { videos: VideoResult[] }) {
    if (!videos || videos.length === 0) return null;

    return (
        <div className="mt-3 p-3 bg-secondary/50 border border-secondary rounded-xl max-w-lg flex flex-col gap-4 shadow-md">
            <h4 className="text-base font-bold text-primary">🎥 Suggested Visual Guides:</h4>
            {videos.map((video, index) => {
                let videoId = '';
                try {
                    const url = new URL(video.videoUrl);
                    // Handle both watch?v= and youtu.be/ links
                    videoId = url.searchParams.get('v') || url.pathname.substring(1); 
                } catch (e) {
                    videoId = video.videoUrl.split('watch?v=')[1] || '';
                }

                if (!videoId) return null;

                // Use a secure embed URL
                const embedUrl = `https://www.youtube.com/embed/${videoId}?controls=0&modestbranding=1&rel=0`;

                return (
                    <div key={index} className="flex flex-col gap-2 border-t border-border pt-2 first:border-t-0 first:pt-0">
                        <h5 className="text-sm font-semibold text-foreground truncate">{video.title}</h5>
                        <iframe
                            className="w-full h-40 rounded-lg"
                            src={embedUrl}
                            title={`Krishi-Mitra Video Suggestion ${index + 1}`}
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                        ></iframe>
                        <a 
                            href={video.videoUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs text-primary font-medium hover:underline text-right"
                        >
                            Watch Full Video on YouTube
                        </a>
                    </div>
                );
            })}
        </div>
    );
}

function ChatbotContent() {
    const { translations: t, currentLang, setCurrentLang } = useLanguage();
    const { latestSoilReport } = useAdvisory();
    const [isMounted, setIsMounted] = useState(false);
    
    // ----- STATE (No change) -----
    const [chatHistory, setChatHistory] = useState<ChatHistory>({});
    const [activeChatId, setActiveChatId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [speechError, setSpeechError] = useState<string | null>(null);
    const [isSheetOpen, setIsSheetOpen] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY_CHATBOT;

    // Voice recognition hook
    const { isListening, error: voiceError, startListening, stopListening } = useVoiceRecognition(
        currentLang,
        (transcript) => {
            setInput(prev => (prev ? prev + " " : "") + transcript);
        }
    );

    useEffect(() => { setIsMounted(true); }, []);

    // ----- CHAT MANAGEMENT (No change) -----
    const handleNewChat = useCallback(() => {
        const multilingualMessages = getMultilingualMessages(currentLang);
        const newChatId = Date.now().toString();
        const initialMessage: Message = {
            role: 'bot',
            text: multilingualMessages.welcome,
            html: `<strong>${multilingualMessages.welcome}</strong>`,
            suggestions: multilingualMessages.suggestions,
            timestamp: Date.now()
        };
        
        const newChat: Chat = {
            id: newChatId,
            title: getSafeTranslation(t, 'chatbotUI.newChat', 'New Chat'),
            timestamp: Date.now(),
            messages: [initialMessage],
        };
        
        setChatHistory(prev => ({ ...prev, [newChatId]: newChat }));
        setActiveChatId(newChatId);
        setMessages([initialMessage]);
        setIsSheetOpen(false);
    }, [currentLang, t]);

    const handleDeleteChat = useCallback((idToDelete: string) => {
        setChatHistory(prev => {
            const newHistory = { ...prev };
            delete newHistory[idToDelete];
            return newHistory;
        });

        if (activeChatId === idToDelete) {
            handleNewChat(); 
        }
    }, [activeChatId, handleNewChat]);


    // ----- LOCAL STORAGE MANAGEMENT (No change) -----
    useEffect(() => {
        if (!isMounted) return;
        
        try {
            const savedHistory = localStorage.getItem("krishi-mitra-conversations");
            const lastActiveId = localStorage.getItem("krishi-mitra-active-chat-id");
            
            let history: ChatHistory = {};
            if (savedHistory) {
                try {
                    const parsed = JSON.parse(savedHistory);
                    if (typeof parsed === 'object' && parsed !== null) {
                        history = parsed;
                    }
                } catch (e) {
                    console.warn('Failed to parse chat history');
                }
            }
            
            setChatHistory(history);
            
            if (lastActiveId && history[lastActiveId]) {
                setActiveChatId(lastActiveId);
                setMessages(history[lastActiveId].messages);
            } else {
                handleNewChat();
            }
        } catch (error) {
            console.error('Initialization error:', error);
            handleNewChat();
        }
    }, [isMounted, currentLang, handleNewChat]);

    useEffect(() => {
        if (!isMounted || Object.keys(chatHistory).length === 0) return;
        
        try {
            localStorage.setItem("krishi-mitra-conversations", JSON.stringify(chatHistory));
            if (activeChatId) {
                localStorage.setItem("krishi-mitra-active-chat-id", activeChatId);
            }
        } catch (error) {
            console.error('Error saving chat history:', error);
        }
    }, [chatHistory, activeChatId, isMounted]);
    
    useEffect(() => {
        if (activeChatId && messages.length > 0) {
            setChatHistory(prev => ({
                ...prev,
                [activeChatId]: {
                    ...prev[activeChatId],
                    messages: messages,
                    timestamp: Date.now(),
                },
            }));
        }
    }, [messages, activeChatId]);



    const sendMessageToGemini = useCallback(async (message: string, image: File | null = null) => {
        if (!GEMINI_API_KEY || !activeChatId) return;
        setIsLoading(true);

        const languageMap: Record<Language, string> = { en: "English", hi: "Hindi", mr: "Marathi", pa: "Punjabi", kn: "Kannada", ta: "Tamil" };
        const languageName = languageMap[currentLang];
        const isFirstUserMessage = messages.length === 1 && chatHistory[activeChatId]?.title.includes("New Chat");
        const titleInstruction = isFirstUserMessage ? "After your response, on a new line, provide a short, 3-5 word title for this conversation prefixed with `Title: `." : "";
        
        let soilDataContext = "";
        if (latestSoilReport) {
            const reportDate = new Date(latestSoilReport.timestamp).toLocaleDateString();
            const reportEntries = Object.entries(latestSoilReport)
                .filter(([key, value]) => key !== 'timestamp' && value !== undefined && value !== null && !isNaN(Number(value)))
                .map(([key, value]) => `  - ${key.toUpperCase()}: ${value}`)
                .join("\n");

            soilDataContext = `
---
IMPORTANT CONTEXT: SOIL HEALTH REPORT
This is the user's soil health data from a report analyzed on ${reportDate}. You MUST use this information to answer any relevant questions about their soil, crops, or fertilizers. Do not ask for this information again.
Soil Data:
${reportEntries}
---
`;
        }

        // --- MODIFIED SYSTEM PROMPT to request THREE search queries ---
        const STRICT_SYSTEM_PROMPT = `You are Krishi-Mitra, an expert Indian agricultural assistant. You have access to the user's soil health data provided below if available.
${soilDataContext}
You MUST reply in ${languageName}, using simple words. Provide short, practical, and low-cost advice.
${titleInstruction}

**VIDEO SUGGESTION INSTRUCTION:**
If the user's question involves a practical step, technique, or visual identification (e.g., 'How to apply fertilizer,' 'Identify this disease,' 'How to use this tool') OR if the user explicitly asks for a video (e.g., "suggest a video"), you MUST suggest **three separate search queries** for high-quality, detailed YouTube videos (4+ minutes).
1. The first query should be **specific to the user's exact need**.
2. The second query should be a **broader topic** related to the solution (e.g., 'sustainable farming methods').
3. The third query should be in **Hindi or English** if it is a more popular search term.
The queries should be concise and relevant.

If you suggest videos, add the three search terms on a new line at the very end of your response, prefixed with exactly: \`VIDEO_SEARCH_QUERIES: [Query 1] ||| [Query 2] ||| [Query 3]\`.
Do NOT generate this line for abstract or simple factual questions.`;
        // ---------------------------------------------------
        
        let userParts: any[] = [{ text: `${message || "Please analyze the image."}` }];
        if (image) {
            try {
                const base64Image = await fileToBase64(image);
                userParts.push({ inline_data: { mime_type: image.type, data: base64Image } });
            } catch (error) {
                console.error("Error converting file to base64:", error);
                setMessages(p => [...p, { role: "bot", text: "⚠️ Error processing the image file.", html: "⚠️ Error processing the image file." }]);
                setIsLoading(false);
                return;
            }
        }
        
        try {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, { 
                method: "POST", 
                headers: { "Content-Type": "application/json" }, 
                body: JSON.stringify({ 
                    contents: [
                        { role: "user", parts: [{ text: STRICT_SYSTEM_PROMPT }] }, 
                        { role: "model", parts: [{ text: "Ok, I am Krishi-Mitra. I will help." }] }, 
                        ...messages.map((m) => ({ role: m.role === "bot" ? "model" : "user", parts: [{ text: m.text }] })), 
                        { role: "user", parts: userParts }, 
                    ], 
                }), 
            });

            if (!res.ok) throw new Error(`API error: ${res.status}`);
            
            const data = await res.json();
            let raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "⚠️ No response";
            
            // 1. Extract and clean up Title
            const titleMatch = raw.match(/Title: (.*)/);
            if (titleMatch?.[1] && activeChatId) {
                const newTitle = titleMatch[1].trim();
                setChatHistory(prev => ({ ...prev, [activeChatId]: { ...prev[activeChatId], title: newTitle } }));
                raw = raw.replace(/Title: .*/, "").trim();
            }
            
            // 2. Extract the MULTIPLE SEARCH QUERIES
            let videoQueries: string[] = [];
            let finalVideoResults: VideoResult[] | undefined;
            const queryMatch = raw.match(/VIDEO_SEARCH_QUERIES: (.*)/);

            if (queryMatch) {
                // Split the captured string by the ' ||| ' delimiter
                videoQueries = queryMatch[1].trim().split(' ||| ').map(q => q.trim()).filter(q => q.length > 0);
                
                // Remove the query line from the main text response
                raw = raw.replace(/VIDEO_SEARCH_QUERIES: .*/, "").trim();

                // --- CHAINED SEARCH CALL (Now sending an array) ---
                if (videoQueries.length > 0) {
                    try {
                        const searchRes = await fetch('/api/youtube-search', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ queries: videoQueries }),
                        });

                        const searchData = await searchRes.json();
                        
                        if (searchData.success && Array.isArray(searchData.videos)) {
                            finalVideoResults = searchData.videos; // Expecting an array of { videoUrl, title }
                        } else {
                            console.warn("YouTube search tool returned no videos or failed.");
                        }
                    } catch (searchError) {
                        console.error("Error calling YouTube search endpoint:", searchError);
                    }
                }
                // -------------------------------------------------------------------
            }

            // 3. Update messages
            setMessages(p => [...p, { 
                role: "bot", 
                text: raw, 
                html: mdToHtml(raw), 
                suggestions: [], 
                videos: finalVideoResults // Pass the array of video results
            }]);
        } catch (err: any) {
            setMessages(p => [...p, { role: "bot", text: `⚠️ Error: ${err.message}`, html: `⚠️ Error: ${err.message}` }]);
        } finally {
            setIsLoading(false);
        }
    }, [activeChatId, chatHistory, currentLang, messages, GEMINI_API_KEY, latestSoilReport]);

    const handleSelectChat = useCallback((id: string) => {
        if (id === activeChatId) {
            setIsSheetOpen(false);
            return;
        }
        
        if (chatHistory[id]) {
            setActiveChatId(id);
            setMessages(chatHistory[id].messages);
            setIsSheetOpen(false);
        }
    }, [activeChatId, chatHistory]);

    // ----- FILE HANDLING (No change) -----
    const handleRemoveImage = useCallback(() => {
        setImageFile(null);
        setImagePreview(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    }, []);

    const handleImageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                setSpeechError('Please select a valid image file.');
                return;
            }
            if (file.size > 10 * 1024 * 1024) { // 10MB limit
                setSpeechError('Image size must be less than 10MB.');
                return;
            }
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
            setSpeechError(null);
        }
    }, []);

    // ----- VOICE RECOGNITION (No change) -----
    const handleMicClick = useCallback(() => {
        if (isListening) {
            stopListening();
            return;
        }
        setSpeechError(null);
        startListening();
    }, [isListening, startListening, stopListening]);

    useEffect(() => {
        if (voiceError) {
            setSpeechError(voiceError);
        }
    }, [voiceError]);

    // ----- SEND MESSAGE (No change) -----
    const handleSend = useCallback(() => {
        if (!t || (input.trim() === "" && !imageFile)) return;
        
        const userMsg: Message = {
            role: "user",
            text: input.trim(),
            image: imagePreview || undefined,
            timestamp: Date.now()
        };
        
        setMessages(prev => [...prev, userMsg]);
        sendMessageToGemini(input.trim(), imageFile);
        setInput("");
        handleRemoveImage();
    }, [input, imageFile, imagePreview, handleRemoveImage, sendMessageToGemini, t]);


    // ----- SCROLL TO BOTTOM (No change) -----
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isLoading]);


    // ----- UI RENDER (Updated for multiple videos) -----
    if (!isMounted) {
        // ... (Loading state) ...
        return (
            <div className="fixed inset-0 z-50 flex bg-background text-foreground items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Loading Krishi-Mitra Chat...</p>
                </div>
            </div>
        );
    }

    const placeholderText = getSafeTranslation(t, 'chatbotUI.placeholder', 'Ask a farming question...');
    const currentChatTitle = activeChatId && chatHistory[activeChatId] 
        ? chatHistory[activeChatId].title 
        : "Chat Bot";


    return (
        <div className="fixed inset-0 z-50 flex bg-background text-foreground">
            {/* Sidebar for Desktop */}
            <div className="hidden md:flex md:w-72 lg:w-80"> 
                <ChatHistorySidebar 
                    chatHistory={Object.values(chatHistory)} 
                    activeChatId={activeChatId} 
                    onNewChat={handleNewChat} 
                    onSelectChat={handleSelectChat} 
                    onDeleteChat={handleDeleteChat}
                /> 
            </div>

            <div className="flex flex-1 flex-col overflow-hidden">
                {/* Header */}
                <header className="border-b border-border bg-card/80 backdrop-blur-md flex-shrink-0">
                    <div className="container mx-auto max-w-4xl px-4 py-3 flex items-center justify-between">
                        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                            <SheetTrigger asChild className="md:hidden">
                                <Button variant="ghost" size="icon">
                                    <Menu className="h-5 w-5" />
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="left" className="p-0 w-80">
                                <ChatHistorySidebar 
                                    chatHistory={Object.values(chatHistory)} 
                                    activeChatId={activeChatId} 
                                    onNewChat={handleNewChat} 
                                    onSelectChat={handleSelectChat} 
                                    onDeleteChat={handleDeleteChat}
                                />
                            </SheetContent>
                        </Sheet>

                        <div className="flex flex-col items-center">
                            <h1 className="text-lg font-bold text-foreground truncate max-w-[150px] sm:max-w-xs">
                                {currentChatTitle}
                            </h1>
                            <p className="text-xs text-primary font-medium">Online</p>
                        </div>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                    <Languages className="h-5 w-5" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                {["en", "hi", "mr", "pa", "kn", "ta"].map(lang => (
                                    <DropdownMenuItem key={lang} onSelect={() => setCurrentLang(lang as Language)}>
                                        {lang === "en" ? "English" : 
                                         lang === "hi" ? "हिंदी" :
                                         lang === "mr" ? "मराठी" :
                                         lang === "pa" ? "ਪੰਜਾਬੀ" :
                                         lang === "kn" ? "ಕನ್ನಡ" : "தமிழ்"}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </header>

                {/* Chat Area */}
                <main className="flex-1 overflow-y-auto p-4">
                    <div className="space-y-6 container mx-auto max-w-4xl">
                        {messages.map((message, index) => (
                            <div key={index} className={cn(
                                "flex items-start gap-3 w-full", 
                                message.role === "user" ? "justify-end" : "justify-start"
                            )}>
                                {message.role === "bot" && (
                                    <Avatar className="h-8 w-8 bg-primary/20 flex-shrink-0">
                                        <AvatarFallback className="bg-transparent">
                                            <Bot className="h-5 w-5 text-primary" />
                                        </AvatarFallback>
                                    </Avatar>
                                )}
                                
                                <div className="w-full">
                                    <div className={cn(
                                        "max-w-[85%] rounded-2xl p-3 text-sm shadow-sm inline-block", 
                                        message.role === "user" 
                                            ? "bg-primary text-primary-foreground rounded-br-none float-right" 
                                            : "bg-card border rounded-bl-none text-foreground"
                                    )}>
                                        {message.image && (
                                            <img src={message.image} alt="User upload" className="rounded-lg mb-2 max-w-full" />
                                        )}
                                        <div dangerouslySetInnerHTML={{ __html: message.html || message.text }} />
                                    </div>
                                    
                                    {message.role === "bot" && (
                                        <>
                                            <div className="flex items-center gap-1 mt-1">
                                                <Speaker text={message.text} lang={currentLang} />
                                            </div>
                                            
                                            {/* --- YOUTUBE PLAYER INTEGRATION (Now renders multiple) --- */}
                                            {message.videos && message.videos.length > 0 && (
                                                <YouTubePlayer videos={message.videos} />
                                            )}
                                            {/* -------------------------------------------------------- */}

                                            {message.suggestions?.length ? (
                                                <SuggestionButtons 
                                                    suggestions={message.suggestions} 
                                                    onSuggestionClick={(suggestion) => {
                                                        const userMsg: Message = {
                                                            role: "user",
                                                            text: suggestion,
                                                            timestamp: Date.now()
                                                        };
                                                        setMessages(prev => [...prev, userMsg]);
                                                        sendMessageToGemini(suggestion, null);
                                                    }} 
                                                />
                                            ) : null}
                                        </>
                                    )}
                                </div>
                                
                                {message.role === "user" && (
                                    <Avatar className="h-8 w-8 flex-shrink-0">
                                        <AvatarFallback className="bg-muted text-muted-foreground">
                                            <User className="h-5 w-5" />
                                        </AvatarFallback>
                                    </Avatar>
                                )}
                            </div>
                        ))}
                        
                        {isLoading && (
                            <div className="flex items-start gap-3 justify-start">
                                <Avatar className="h-8 w-8 bg-primary/20">
                                    <AvatarFallback className="bg-transparent">
                                        <Bot className="h-5 w-5 text-primary" />
                                    </AvatarFallback>
                                </Avatar>
                                <div className="bg-muted rounded-2xl p-3 text-sm rounded-bl-none shadow-sm">
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <LoaderCircle className="animate-spin h-4 w-4 text-primary" />
                                        <span>{getSafeTranslation(t, 'chatbotUI.thinking', 'Thinking...')}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                </main>

                {/* Input Footer */}
                <footer className="border-t border-border bg-card/80 backdrop-blur-md flex-shrink-0">
                    <div className="container mx-auto max-w-4xl p-2 sm:p-4">
                        {imagePreview && (
                            <div className="relative w-fit mb-2 ml-2">
                                <img src={imagePreview} alt="Selected preview" className="h-20 w-20 object-cover rounded-md" />
                                <Button
                                    variant="destructive"
                                    size="icon"
                                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                                    onClick={handleRemoveImage}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                        
                        {speechError && (
                            <p className="text-xs text-destructive mb-2 ml-4">{speechError}</p>
                        )}

                        <div className="relative flex w-full items-center rounded-full border bg-background focus-within:ring-1 focus-within:ring-primary transition-all">
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="image/*"
                                onChange={handleImageChange}
                                onClick={(e) => {
                                    (e.target as HTMLInputElement).value = '';
                                }}
                            />

                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-9 w-9 ml-1 rounded-full flex-shrink-0" 
                                onClick={() => fileInputRef.current?.click()}
                                title="Attach image"
                            >
                                <Paperclip className="h-5 w-5" />
                            </Button>

                            <Textarea
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder={placeholderText}
                                className="flex-1 resize-none border-0 bg-transparent px-2 py-2 text-sm placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
                                rows={1}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSend();
                                    }
                                }}
                                disabled={isLoading}
                            />

                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className={cn(
                                    "h-9 w-9 rounded-full flex-shrink-0", 
                                    isListening && "bg-red-500 text-white hover:bg-red-600 animate-pulse"
                                )} 
                                onClick={handleMicClick}
                                title="Voice input"
                                disabled={isLoading}
                            >
                                <Mic className="h-5 w-5" />
                            </Button>

                            <Button 
                                type="submit" 
                                size="icon" 
                                className="h-9 w-9 mr-1 rounded-full flex-shrink-0" 
                                onClick={handleSend} 
                                disabled={isLoading || (input.trim() === "" && !imageFile)}
                                title="Send"
                            >
                                <Send className="h-5 w-5" />
                            </Button>
                        </div>
                    </div>
                </footer>
            </div>
        </div>
    );
}

// ---------- EXPORT WITH ERROR BOUNDARY ----------
export default function ChatbotPage() {
    return (
        <ChatbotErrorBoundary>
            <ChatbotContent />
        </ChatbotErrorBoundary>
    );
}