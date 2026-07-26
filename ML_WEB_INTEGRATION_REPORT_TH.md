# รายงานการพัฒนาระบบ ScoutAI: การเชื่อม Machine Learning เข้ากับ Web Application

วันที่จัดทำ: 25 กรกฎาคม 2026

## 1. วัตถุประสงค์

โครงการนี้มีเป้าหมายเพื่อเปลี่ยนระบบ Machine Learning สำหรับค้นหานักฟุตบอลที่มีรูปแบบการเล่นใกล้เคียงกัน จากเดิมที่ใช้งานได้เฉพาะภายใน Jupyter Notebook ให้กลายเป็นระบบที่หน้าเว็บสามารถเรียกใช้งานได้จริงผ่าน API

ข้อกำหนดสำคัญของงานคือ:

- ต้องไม่เปลี่ยน logic ของ Machine Learning เดิม
- หน้าเว็บต้องไม่เรียก Python โดยตรง
- ต้องแยกหน้าที่ของ Frontend, Backend และ ML Service ให้ชัดเจน
- ผลลัพธ์ต้องส่งกลับในรูปแบบ JSON เพื่อให้หน้าเว็บนำไปแสดงผลได้
- ต้องรองรับกรณีไม่พบนักเตะ ชื่อซ้ำ และ ML Service ไม่พร้อมใช้งาน

## 2. ภาพรวมระบบก่อนพัฒนา

ก่อนเริ่มงาน ระบบแบ่งออกเป็น 3 ส่วนหลัก:

1. `frontend` เป็น React/Vite สำหรับค้นหานักเตะ
2. `backend` เป็น Node.js/Express สำหรับเชื่อม Supabase
3. `ScoutAI` มี ML logic อยู่ภายใน `ai.ipynb`

Flow เดิม:

```text
React
  → Express
  → Supabase
  → แสดงข้อมูลนักเตะ
```

ข้อจำกัดคือ ML ภายใน Notebook ยังไม่สามารถถูกเรียกจากหน้าเว็บได้ และผลลัพธ์ส่วนใหญ่ถูกแสดงผ่าน `print`, Jupyter Widget และกราฟ Matplotlib

## 3. สถาปัตยกรรมหลังพัฒนา

ระบบหลังพัฒนาใช้สถาปัตยกรรมดังนี้:

```mermaid
flowchart LR
    User["ผู้ใช้งาน"] --> React["React / Vite<br/>Port 5173"]
    React --> Express["Express API<br/>Port 5000"]
    Express --> FastAPI["FastAPI ML Service<br/>Port 8000"]
    FastAPI --> Engine["ScoutEngine"]
    Engine --> CSV["fm_dataset.csv"]
    Engine --> FastAPI
    FastAPI --> Express
    Express --> React
```

Flow การเรียก recommendation:

```text
ผู้ใช้กรอกชื่อนักเตะ
  → React ส่ง POST /api/recommendations
  → Express ตรวจสอบข้อมูล
  → Express ส่ง POST /v1/recommend ไป FastAPI
  → FastAPI เรียก ScoutEngine
  → ScoutEngine ประมวลผล ML ทั้ง 5 algorithms
  → ส่งผล JSON กลับ Express
  → React แสดงผลบนหน้า Result
```

เหตุผลที่ไม่ให้ React เรียก FastAPI โดยตรง:

- Express ทำหน้าที่เป็น API Gateway ของระบบ
- ซ่อนตำแหน่งและรายละเอียดของ ML Service จาก Browser
- จัดการ validation, timeout และ error ได้จากจุดเดียว
- รองรับการเพิ่ม authentication, rate limiting และ AI analysis ในอนาคต

## 4. การแปลง Notebook เป็น ScoutEngine

### 4.1 ไฟล์ที่สร้าง

```text
ScoutAI/scout_engine.py
```

ไฟล์นี้ถอด ML logic จาก `ScoutAI/ai.ipynb` มาเป็น Python module ที่เรียกซ้ำได้

Interface หลัก:

```python
from ScoutAI.scout_engine import recommend_players

result = recommend_players("Kevin De Bruyne")
```

หรือ:

```python
engine = ScoutEngine()
result = engine.recommend("Kevin De Bruyne")
```

### 4.2 สิ่งที่คงไว้จาก Notebook

การพัฒนาไม่ได้เปลี่ยน logic ของ ML โดยยังคงองค์ประกอบต่อไปนี้:

- รายการคอลัมน์เดิม 98 คอลัมน์
- ML features ที่ใช้งานได้จริง 89 features
- การแทนค่า `-` ด้วย missing value
- การทำความสะอาดค่าตัวเลขด้วย Regular Expression
- การแทน missing numerical values ด้วย `0`
- การสร้าง `Gen_Pos` จากตำแหน่งของนักเตะ
- การปรับมาตรฐานข้อมูลด้วย `StandardScaler`
- Random seed เท่ากับ `42`
- GridSearchCV แบบ 3-fold
- Silhouette Analysis
- Dynamic Feature Weighting
- สูตรแปลงระยะทางเป็นเปอร์เซ็นต์
- ML algorithms ทั้ง 5 วิธี

### 4.3 Hyperparameter tuning เดิม

K-NN proxy classification ทดสอบค่า:

```text
1, 3, 5, 7, 10
```

ผลที่ได้:

```text
Best K-NN K = 7
Proxy Task Accuracy ≈ 80.93%
```

K-Means ทดสอบจำนวน cluster:

```text
5, 10, 15, 20
```

ผลที่ได้:

```text
Best K-Means K = 10
```

### 4.4 Dynamic Feature Weighting

น้ำหนักที่คงไว้จาก Notebook:

| กลุ่ม Feature | น้ำหนัก |
|---|---:|
| Financial features | 0.20 |
| National team features | 0.10 |
| Hidden/personality features | 0.50 |
| GK features สำหรับผู้เล่น outfield | 0.01 |
| Outfield features สำหรับผู้รักษาประตู | 0.01 |
| GK features สำหรับผู้รักษาประตู | 2.00 |
| Top 5 เด่นของ target player | คูณเพิ่ม 1.50 |

### 4.5 Algorithms ที่ใช้งาน

1. K-Nearest Neighbors ใช้ Euclidean distance
2. Cosine Similarity ใช้วัดสัดส่วนรูปแบบการเล่น
3. Radius Nearest Neighbors ใช้ radius เท่ากับ `15.0`
4. K-Means ใช้ cluster ที่ได้จาก Silhouette Analysis
5. DBSCAN ใช้ dynamic epsilon จากค่าเฉลี่ย K-NN distance คูณ `1.2`

ผลลัพธ์จาก Notebook เดิมถูกเปลี่ยนจากการ `print` และวาดกราฟให้เป็น dictionary ที่แปลงเป็น JSON ได้ โดยไม่มีการเปลี่ยนสูตรคำนวณหรืออันดับนักเตะ

### 4.6 การจัดการชื่อผู้เล่น

เพิ่ม exception สำหรับกรณี:

- ไม่พบนักเตะ
- ชื่อบางส่วนตรงกับนักเตะมากกว่าหนึ่งคน

หากมี exact match เพียงหนึ่งรายการ ระบบจะเลือก exact match ตามพฤติกรรมเดิมของ Notebook

ชั้นค้นหาชื่อรองรับ Unicode normalization โดยไม่เปลี่ยนข้อมูลที่ส่งเข้า ML เช่น ผู้ใช้สามารถพิมพ์ `Kylian Mbappe` เพื่อค้นหาแถวข้อมูล `Kylian Mbappé` ได้

### 4.7 ข้อมูลพลังสำหรับแสดงผล

หลังจาก ML จัดอันดับเสร็จ ระบบจะเพิ่มข้อมูลประกอบจากแถว dataset เดิมให้ target และ candidates โดยไม่เปลี่ยน Score หรืออันดับ ได้แก่:

- CA และ PA
- Club, Position และ Nationality
- Market Value และ Salary
- Height, Weight, Left Foot และ Right Foot
- Technical attributes
- Mental attributes
- Physical attributes
- Goalkeeping attributes

ข้อมูลส่วนนี้เป็น display enrichment หลังการคำนวณ ML และไม่ได้ถูกนำไปคำนวณซ้ำ

## 5. การสร้าง FastAPI ML Service

### 5.1 ไฟล์ที่สร้าง

```text
ScoutAI/api.py
```

ใช้ FastAPI เป็น HTTP interface ครอบ `ScoutEngine`

### 5.2 การโหลด Engine

Engine ถูกสร้างหนึ่งครั้งระหว่าง FastAPI lifespan:

```text
FastAPI startup
  → โหลด CSV
  → ทำ preprocessing
  → ทำ scaling และ tuning
  → เก็บ ScoutEngine ไว้ใน app.state
```

ข้อดีคือไม่ต้องโหลดข้อมูลและ tune ใหม่ทุก request

### 5.3 Endpoints

#### ตรวจสถานะ ML

```http
GET /health
```

ตัวอย่างผลลัพธ์:

```json
{
  "status": "ok",
  "engine": "ready",
  "datasetRows": 8452,
  "featureCount": 89,
  "bestKnnK": 7,
  "bestKMeansK": 10
}
```

#### ขอ recommendation

```http
POST /v1/recommend
Content-Type: application/json

{
  "playerName": "Kevin De Bruyne"
}
```

ผลลัพธ์ประกอบด้วย:

- ข้อมูล target player
- ผลลัพธ์แยกตาม 5 algorithms
- Name, Score, Age, CA และ Market Value ของ candidate
- ข้อมูล model configuration

### 5.4 HTTP errors

| Status | ความหมาย |
|---:|---|
| 404 | ไม่พบนักเตะ |
| 409 | ชื่อตรงกับนักเตะหลายคน |
| 422 | Request ไม่ถูกต้องหรือชื่อว่าง |
| 503 | Engine ยังไม่พร้อม |

## 6. การเชื่อม Express Backend กับ FastAPI

### 6.1 ไฟล์ที่สร้าง

```text
backend/src/services/recommendationService.js
```

หน้าที่ของ service:

- ตรวจสอบ `playerName`
- เรียก FastAPI ผ่าน HTTP
- กำหนด timeout
- ตรวจสอบว่า FastAPI ส่ง JSON ที่ถูกต้อง
- แปลง error จาก FastAPI ให้เป็น error ของ Express
- แยกกรณี FastAPI ไม่ทำงานและกรณี timeout

### 6.2 Express endpoints

#### ตรวจ ML ผ่าน Express

```http
GET /api/ml/health
```

#### เรียก recommendation ผ่าน Express

```http
POST /api/recommendations
Content-Type: application/json

{
  "playerName": "Kevin De Bruyne"
}
```

### 6.3 Environment variables

Express รองรับ:

```env
ML_API_URL=http://127.0.0.1:8000
ML_API_TIMEOUT_MS=120000
```

หากไม่กำหนด ระบบใช้ค่าด้านบนเป็นค่าเริ่มต้น

### 6.4 Error mapping

| กรณี | Express Status |
|---|---:|
| ชื่อไม่ถูกต้อง | 400 |
| ไม่พบนักเตะ | 404 |
| ชื่อกำกวม | 409 |
| FastAPI validation error | 422 |
| FastAPI ไม่ทำงาน | 503 |
| FastAPI timeout | 504 |
| FastAPI ส่งข้อมูลผิดรูปแบบ | 502 |

## 7. การเชื่อม React Frontend

### 7.1 Routing

เพิ่ม routes:

```text
/        → หน้า Search
/result  → หน้าแสดงผล ML
```

ไฟล์ที่เกี่ยวข้อง:

```text
frontend/src/routes/AppRoutes.jsx
frontend/src/pages/Search.jsx
frontend/src/pages/Result.jsx
```

### 7.2 หน้า Search

ความสามารถ:

- รับชื่อนักเตะจากผู้ใช้
- ตรวจสอบความยาวขั้นต่ำ
- มีตัวอย่างชื่อสำหรับทดสอบ
- ส่งชื่อผ่าน URL query parameter ไปหน้า Result

ตัวอย่าง:

```text
/result?player=Kevin+De+Bruyne
```

### 7.3 หน้า Result

ความสามารถ:

- เรียก `POST /api/recommendations`
- แสดง loading ระหว่าง ML ประมวลผล
- แสดงข้อมูล target player
- แสดงผลจากทั้ง 5 models
- แสดงอันดับ, Similarity Score, Age และ CA
- แสดง score bar
- แสดง CA, PA และตำแหน่งเต็มของ target player
- แสดงค่าพลังแบบ 1–20 แยก Technical, Mental และ Physical
- แสดง Goalkeeping attributes สำหรับผู้รักษาประตู
- เปิดดูค่าพลังของ candidate แต่ละคนแบบพับเก็บได้
- รองรับผลลัพธ์ว่างจากบาง model
- รองรับ API error และปุ่ม retry
- หากชื่อกำกวม แสดงรายชื่อนักเตะให้ผู้ใช้เลือก
- รองรับหน้าจอขนาดเล็กและขนาดใหญ่

### 7.4 API client และ cache

ไฟล์:

```text
frontend/src/services/api.js
```

ตั้งค่า:

```env
VITE_API_URL=http://localhost:5000
```

Frontend มี in-memory request cache ตามชื่อนักเตะ เพื่อป้องกัน React Strict Mode ส่ง ML request ซ้ำโดยไม่จำเป็น

เมื่อผู้ใช้กด retry ระบบจะลบ cache ของชื่อนั้นก่อนส่ง request ใหม่

## 8. การทดสอบระบบ

### 8.1 ML parity tests

ไฟล์:

```text
ScoutAI/tests/test_scout_engine.py
```

วิธีทดสอบ:

- Execute ML cells จาก Notebook เดิมเป็น reference
- เรียก `ScoutEngine` ด้วยนักเตะคนเดียวกัน
- เปรียบเทียบรายชื่อนักเตะ
- เปรียบเทียบ Age และ CA
- เปรียบเทียบ Score ด้วยความละเอียด 10 ตำแหน่ง
- เปรียบเทียบค่า tuning
- ตรวจว่า result แปลงเป็น JSON ได้
- ทดสอบกรณีไม่พบชื่อและชื่อกำกวม
- ทดสอบการค้นหาชื่อโดยไม่ใส่ accent

ผลการทดสอบที่บันทึกไว้:

```text
6 tests passed
```

### 8.2 FastAPI tests

ไฟล์:

```text
ScoutAI/tests/test_api.py
```

ทดสอบ:

- Health endpoint
- Recommendation สำเร็จ
- 404 player not found
- 409 ambiguous name
- 422 blank name
- FastAPI request validation

ผลการทดสอบ:

```text
6 tests passed
```

### 8.3 Express integration tests

ไฟล์:

```text
backend/test/recommendations.test.js
```

ใช้ Node.js built-in test runner และ mock ML server ผ่าน HTTP จริง

ทดสอบ:

- Express health proxy
- Recommendation proxy
- Input validation
- การส่งรายละเอียดชื่อกำกวมจาก FastAPI ถึง Client

ผลการทดสอบ:

```text
4 tests passed
```

### 8.4 End-to-end integration

มีการเปิด FastAPI และ Express คนละ process แล้วส่ง request จริง:

```text
Express
  → FastAPI
  → ScoutEngine
  → fm_dataset.csv
  → JSON response
```

ผลทดสอบด้วย `Kevin De Bruyne`:

```text
FastAPI health: 200
Express ML health: 200
Recommendation: 200
Target: Kevin De Bruyne
Models: 5
K-NN results: 5
Cosine results: 5
```

### 8.5 Frontend validation

ดำเนินการ:

```bash
npm run lint
npm run build
```

ผลลัพธ์:

```text
ESLint passed
Vite production build passed
```

## 9. วิธีเปิดระบบ

### Terminal 1: FastAPI

```powershell
cd D:\Project-Football-ML-AI
.\ScoutAI\.venv\Scripts\Activate.ps1
python -m uvicorn ScoutAI.api:app --host 127.0.0.1 --port 8000
```

### Terminal 2: Express

```powershell
cd D:\Project-Football-ML-AI\backend
npm run dev
```

### Terminal 3: React

```powershell
cd D:\Project-Football-ML-AI\frontend
npm run dev
```

เปิดหน้าเว็บ:

```text
http://localhost:5173
```

## 10. แหล่งข้อมูลที่ระบบใช้อยู่

### Machine Learning

ML Engine ยังอ่านข้อมูลจาก:

```text
ScoutAI/fm_dataset.csv
```

ด้วย:

```python
pd.read_csv(...)
```

Dataset ที่ทดสอบมี:

```text
8,452 players
98 source columns
89 ML features
```

### Supabase

Supabase ยังมี endpoint เดิม:

```http
GET /api/players/search
```

ซึ่งใช้ค้นหาข้อมูลจากตาราง:

```text
public.fm_players
```

อย่างไรก็ตาม ML recommendation ไม่ได้อ่านข้อมูลจาก Supabase ในปัจจุบัน

ดังนั้นแหล่งข้อมูลปัจจุบันคือ:

```text
ML recommendation → fm_dataset.csv
Database search   → Supabase fm_players
```

การใช้ CSV ในช่วงพัฒนาไม่ก่อให้เกิดปัญหา ตราบใดที่ข้อมูลไม่จำเป็นต้องเปลี่ยนแบบ real-time และมีการควบคุม version ของ dataset

ข้อควรระวังคือข้อมูล CSV และ Supabase อาจไม่ตรงกันหากมีการอัปเดตเพียงแหล่งเดียว

## 11. สิ่งที่ยังไม่ได้ดำเนินการ

- ยังไม่ได้เชื่อม LLM หรือ Generative AI
- ยังไม่ได้สร้าง AI analysis
- ยังไม่ได้ใช้ n8n
- ยังไม่ได้สร้าง background job/queue
- ยังไม่ได้ให้ ML อ่านข้อมูลจาก Supabase
- ยังไม่มี automatic dataset synchronization
- ยังไม่ได้ deploy ระบบขึ้น production
- ยังไม่มี authentication และ rate limiting
- ยังไม่มี model artifact/version registry
- K-Means และ DBSCAN ยังประมวลผลตาม logic เดิมในแต่ละ recommendation

## 12. แนวทางพัฒนาขั้นถัดไป

ลำดับที่แนะนำ:

1. รวม candidate ที่ซ้ำกันจากทั้ง 5 models
2. คำนวณ attribute differences เพื่อเป็นหลักฐานให้ AI
3. กำหนด JSON schema สำหรับ AI output
4. เพิ่ม AI analysis service ใน Express
5. บันทึกผล ML และ AI ลง Supabase
6. เมื่อใช้งานจริง ให้เปลี่ยน AI analysis เป็น background job
7. ใช้ Supabase Queue หรือ worker แยกสำหรับ retry และควบคุมค่าใช้จ่าย
8. ใช้ n8n เฉพาะ notification, report และ external automation
9. เพิ่ม dataset/model version ก่อนอัปเดตข้อมูลรอบใหม่

## 13. สรุป

ระบบ ScoutAI ได้ถูกเปลี่ยนจาก Notebook ที่ใช้งานแบบ manual ให้เป็น Web-based ML application ที่เรียกใช้งานได้จริง

ผลลัพธ์สำคัญ:

- ML logic เดิมถูกถอดออกมาเป็น reusable engine
- ผลจาก Engine ได้รับการตรวจเทียบกับ Notebook
- FastAPI เปิดให้เรียก ML ผ่าน HTTP
- Express ทำหน้าที่เป็น API Gateway
- React สามารถส่งชื่อนักเตะและแสดงผลทั้ง 5 models
- หน้าเว็บแสดงค่าพลังของ target และ candidates จาก dataset จริง
- ระบบรองรับ loading, validation, retry และชื่อกำกวม
- มี automated tests ครอบคลุม ML, FastAPI และ Express
- ระบบผ่านการทดสอบ end-to-end

สถานะปัจจุบัน:

```text
React → Express → FastAPI → ScoutEngine → CSV
```

ระบบพร้อมสำหรับขั้นต่อไปคือการเพิ่มข้อมูลประกอบของ candidate และเชื่อม AI เพื่อสร้างคำอธิบายเชิง scouting โดยใช้ผล ML เป็นหลักฐาน
