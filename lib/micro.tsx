var baseURL = 'http://localhost:8080'
if(process.env.MICRO_API_ENDPOINT?.length) {
  baseURL = process.env.MICRO_API_ENDPOINT
}

// call makes HTTP JSON calls to the Micro API. If the request succeeds (200), the response body is 
// returned, otherwise the error is parsed from the response body and returned in the reject. If no 
// error is returned in the response body, the response status text is returned.
export default function call(path: string, params?: any): Promise<any> {
  return new Promise<any>((resolve: any, reject: any) => {
    const body = JSON.stringify(params)
    const headers = { 'Content-Type': 'application/json' }
    console.log(`Calling Micro API ${path}`)

    fetch(baseURL + path, { method: 'POST', body , headers })
      .then((async (rsp) => {
        try {
          const data = await rsp.json()
          rsp.status === 200 ? resolve(data) : reject({ error: data["Detail"] || rsp.statusText, code: rsp.status })
        } catch(error) {
          console.error(`Error parsing response from Micro API: ${error}`)
          rsp.status === 200 ? resolve({}) : reject({ error: rsp.statusText, code: rsp.status })
        }
      }))
      .catch((error: any) => {
        console.error(`Error connecting to Micro API: ${error}`);
        reject({ error, code: 500 });
      })
  })
}