import axios from 'axios';

const getBaseUrl = () => {
    let url = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
    if (typeof window !== "undefined") {
        const hostname = window.location.hostname;
        const isSecure = window.location.protocol === "https:";
        if (hostname !== "localhost" && hostname !== "127.0.0.1") {
            if (url.includes("localhost") || url.includes("127.0.0.1")) {
                if (isSecure) {
                    url = `${window.location.origin}/api/v1`;
                } else if (/^[\d.]+$/.test(hostname)) {
                    url = url.replace("localhost", hostname).replace("127.0.0.1", hostname);
                }
            }
        }
    }
    return url;
};

export const refreshAccessToken = async () => {
    const refreshToken = typeof window !== "undefined" ? localStorage.getItem("refreshToken") : null;

    const response = await axios.post(
        `${getBaseUrl()}/auth/refresh`,
        refreshToken ? { refreshToken } : {},
        {
            withCredentials: true,
            headers: {
                "ngrok-skip-browser-warning": "true",
                "X-Requested-With": "XMLHttpRequest",
            },
        }
    );
    return response.data;
};