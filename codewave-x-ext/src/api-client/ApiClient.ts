import axios from "axios";

export class ApiClient {
  private base_url = process.env.BACKEND_BASE_URL || "http://localhost:3000/";

  public callGetApi = async (route: string, payload: any) => {
    try {
      const response = await axios({
        method: "get",
        url: `${this.base_url}/analysis/${route}`,
        headers: {
          "Content-Type": "application/json",
        },
        data: payload,
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          `Request failed: ${error.response?.status} - ${error.message}`
        );
      }
      throw new Error(`Request failed: ${error}`);
    }
  };

  public callPostApi = async (route: string, payload: any) => {
    try {
      const response = await axios({
        method: "post",
        url: `${this.base_url}/analysis/${route}`,
        headers: {
          "Content-Type": "application/json",
        },
        data: payload,
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          `Request failed: ${error.response?.status} - ${error.message}`
        );
      }
      throw new Error(`Request failed: ${error}`);
    }
  };
}
