import axios from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

export const refreshAccessToken = async () => {
    const refreshToken = typeof window !== "undefined" ? localStorage.getItem("refreshToken") : null;

    const response = await axios.post(
        `${BASE_URL}/auth/refresh`,
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