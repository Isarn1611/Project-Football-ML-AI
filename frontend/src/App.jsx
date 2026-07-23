import { useEffect } from "react";
import api from "./services/api";

function App() {
  useEffect(() => {
    api.get("/")
      .then((res) => {
        console.log(res.data);
      })
      .catch((err) => {
        console.error(err);
      });
  }, []);

  return (
    <h1>Football Scout AI</h1>
  );
}

export default App;