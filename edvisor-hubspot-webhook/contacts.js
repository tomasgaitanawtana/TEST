//AgencyID y studentId viene incluido en payload

const axios = require("axios");
const { LambdaClient, InvokeCommand } = require("@aws-sdk/client-lambda");

const {
  DynamoDBClient,
  GetItemCommand,
  UpdateItemCommand,
  QueryCommand,
} = require("@aws-sdk/client-dynamodb");

const querystring = require("querystring");

const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb");

/* const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

const sendEmail = async (error) => {
  const client = new SESClient();
  const command = new SendEmailCommand({
    Source: 'apps@awtana.com',
    Destination: {
      ToAddresses: [
        'miguel.gallo@awtana.com',
        'tomas.gaitan@awtana.com'
      ]
    },
    Message: {
      Subject: {
        Data: 'Error en la aplicación',
        Charset: 'UTF-8'
      },
      Body: {
        Text: {
          Data: `Se ha producido un error:\n\n${error.message}`,
          Charset: 'UTF-8'
        }
      }
    }
  });
​
  try {
    const response = await client.send(command);
    console.log(JSON.stringify(response, null, 2));
  } catch (sesError) {
    console.error(`Error al enviar el correo SES: ${sesError.message}`);
  }
}; */

let hubspotApiKey;
let edvisorAuthToken;
let portalIdtoSearch;
let agencyId;

const edvisorApiUrl = "https://api.edvisor.io/graphql";
const TABLE_NAME = process.env.TABLE_NAME;
const TABLE_NAME_TOKEN = process.env.TABLE_NAME_TOKEN;

const edvisorApi = axios.create({
  baseURL: edvisorApiUrl,
  headers: { Authorization: `Bearer ${edvisorAuthToken}` },
});

async function getEdvisorOwner(agencyIdToSearch, ownerToSearch) {
  console.log("entro al buscador de getEdvisorOwner");

  const client = new DynamoDBClient();

  const input = {
    TableName: TABLE_NAME,
    Key: {
      pk: { S: agencyIdToSearch },
      sk: { S: "agency" },
    },
  };

  const command = new GetItemCommand(input);

  console.log("command", command);

  try {
    console.log("antes de entrar al response");

    const response = await client.send(command);

    console.log("response 1", response);

    if (response.Item) {
      const item = response.Item;
      const agents = item.agents.L;

      for (const agent of agents) {
        const edVisorId = agent.M.userId.N;

        if (parseInt(edVisorId) === parseInt(ownerToSearch)) {
          console.log("coincidieron ", edVisorId, " y ", ownerToSearch);
          return agent.M.hubspot_owner_id.S;
        }
      }
      console.log("no se encontro el propietario");
      return null;
    } else {
      console.log("La respuesta de DynamoDB no tiene la estructura esperada.");
      return null;
    }
  } catch (error) {
    console.error("Error al obtener el item:", error);
    return null;
  }
}

async function updateTokenInDynamoDB(
  portalIdtoSearch,
  accessToken,
  expiresIn,
  refreshToken
) {
  const client = new DynamoDBClient();

  try {
    const expirationTime = new Date(
      new Date().getTime() + expiresIn * 1000 * 0.75
    );

    const updateItemInput = {
      TableName: TABLE_NAME_TOKEN,
      Key: {
        pk: { S: portalIdtoSearch.toString() },
        sk: { S: 'NO_ESPECIFICADO'}
      },
      UpdateExpression:
        "SET HubID = :accessToken, expires_at = :expirationTime, refresh_token = :refreshToken",
      ExpressionAttributeValues: {
        ":accessToken": { S: accessToken },
        ":expirationTime": { S: expirationTime.toISOString() },
        ":refreshToken": { S: refreshToken },
      },
    };

    console.log("datos para actulizar en la table", updateItemInput);

    await client.send(new UpdateItemCommand(updateItemInput));

    console.log("Token actualizado correctamente en DynamoDB.");

    return accessToken;
  } catch (error) {
    console.error("Error al actualizar el token en DynamoDB:", error);
  }
}

async function getAccessToken(agencyCompanyId) {
  const client = new DynamoDBClient();
  let newAccessToken;

  try {

    const queryInput = {
      TableName: TABLE_NAME_TOKEN,
      IndexName: "agencyCompanyId-index", 
      KeyConditionExpression: "agencyCompanyId = :agencyCompanyId",
      ExpressionAttributeValues: {
        ":agencyCompanyId": { S: agencyCompanyId }, //
      },
    };

    const queryResponse = await client.send(new QueryCommand(queryInput));

    console.log('queryResponse.Items',queryResponse.Items);

    if (queryResponse.Items && queryResponse.Items.length > 0) {

      const matchingItem = queryResponse.Items[0];
      
      if (matchingItem && matchingItem.expires_at) {

        const expirationTime = new Date(matchingItem.expires_at.S);

        edvisorAuthToken = matchingItem.edvisor_token.S;
        //id_agencia = matchingItem.id_agency.S;
        portalIdtoSearch = matchingItem.pk.S;

        if (expirationTime.getTime() < Date.now()) {
          console.log("la fecha de expiracion esta vencida");
          const refreshToken = matchingItem.refresh_token.S;

          console.log("Refresh_token anterior", refreshToken);
          console.log("Acces_token anterior", matchingItem.HubID.S);
          console.log("Expires_at anterior", matchingItem.expires_at.S);

          // Realizar la solicitud de refresco del token utilizando el refreshToken
          const tokenUrl = "https://api.hubapi.com/oauth/v1/token";
          const data = {
            grant_type: "refresh_token",
            client_id: matchingItem.client_id.S,
            client_secret: matchingItem.client_secret.S,
            refresh_token: refreshToken,
          };

          let newExpiresIn;
          let newRefreshToken;

          try {
            console.log("Por actualizar refresh_token...");
            console.log("Datos de la solicitud:", data);

            const refreshResponse = await axios.post(
              tokenUrl,
              querystring.stringify(data),
              {
                headers: {
                  "Content-Type":
                    "application/x-www-form-urlencoded;charset=utf-8",
                },
              }
            );

            console.log("Respuesta del servidor:", refreshResponse.data);

            newAccessToken = refreshResponse.data.access_token;
            newExpiresIn = refreshResponse.data.expires_in;
            newRefreshToken = refreshResponse.data.refresh_token;

            console.log("Nuevo AccessToken", newAccessToken);
            console.log("Nuevo ExpiresIn", newExpiresIn);
            console.log("Nuevo RefreshToken", newRefreshToken);
          } catch (error) {
            // Manejar el error
            console.error("Error en la solicitud POST:", error);
          }

          console.log(
            "Actualizando accesstoken,expiresIn y refreshToken en DynamoDB"
          );
          // Actualizar el token y la fecha de expiración en DynamoDB
          const accessTokenDynamo = await updateTokenInDynamoDB(
            portalIdtoSearch,
            newAccessToken,
            newExpiresIn,
            newRefreshToken
          );

          return accessTokenDynamo;
        } else {
          console.log("la fecha de expiracion se encuentra vigente");
          return matchingItem.HubID.S;
        }
      } else {
        console.log("No se encontró el accessToken en DynamoDB.");
        return null;
      }
    } else {
      console.log("No se encontró el accessToken en DynamoDB.");
      return null;
    }
  } catch (error) {
    console.error("Error al obtener el accessToken:", error);
    return null;
  }
}

//Codigo original funcionando
/* async function getAccessToken(agencyId) {
  
  const client = new DynamoDBClient();
  let newAccessToken;
  
  try {
    
    const getItemInput = {
      TableName: TABLE_NAME_TOKEN,
      IndexName: 'id_agency-index',
      KeyConditionExpression: '(id_agency, :id_agency)',//'id_agency = :id_agency',
      ExpressionAttributeValues: {
        ':id_agency': { 'S': agencyId.toString() },
      },
    };

    const response = await client.send(new QueryCommand(getItemInput));

    console.log('response',response.Items[0]);

    if (response.Items[0] && response.Items[0].expires_at) {
      const expirationTime = new Date(response.Items[0].expires_at.S);
      edvisorAuthToken = response.Items[0].edvisor_token.S;
      id_agencia = response.Items[0].id_agency.S;
      portalIdtoSearch = response.Items[0].pk.S;

      if (expirationTime.getTime() < Date.now()) {

          console.log('la fecha de expiracion esta vencida')

          const refreshToken = response.Items[0].refresh_token.S;

          console.log('Refresh_token anterior',refreshToken);
          console.log('Acces_token anterior',response.Items[0].HubID.S);
          console.log('Expires_at anterior',response.Items[0].expires_at.S);
    
          // Realizar la solicitud de refresco del token utilizando el refreshToken
          const tokenUrl = 'https://api.hubapi.com/oauth/v1/token';
          const data = {
            grant_type: 'refresh_token',
            client_id: response.Items[0].client_id.S,
            client_secret: response.Items[0].client_secret.S,
            refresh_token: refreshToken,
          };

          let newExpiresIn;
          let newRefreshToken;

          try {

            console.log('Por actualizar refresh_token...')

            console.log('Datos de la solicitud:', data);

            const refreshResponse = await axios.post(tokenUrl, querystring.stringify(data), {
              headers: {
                  'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
              },
              });

            console.log('Respuesta del servidor:', refreshResponse.data);
          
            newAccessToken = refreshResponse.data.access_token;
            newExpiresIn = refreshResponse.data.expires_in;
            newRefreshToken = refreshResponse.data.refresh_token;
  
            console.log('Nuevo AccessToken',newAccessToken);
            console.log('Nuevo ExpiresIn',newExpiresIn);
            console.log('Nuevo RefreshToken',newRefreshToken);

          } catch (error) {
            // Manejar el error
            console.error('Error en la solicitud POST:', error);
          }
          
          console.log('Actualizando accesstoken,expiresIn y refreshToken en DynamoDB')
          // Actualizar el token y la fecha de expiración en DynamoDB
          const accessTokenDynamo = await updateTokenInDynamoDB(portalIdtoSearch, newAccessToken, newExpiresIn, newRefreshToken);

          return accessTokenDynamo
      } else {
        console.log('la fecha de expiracion se encuentra vigente')
        return response.Items[0].HubID.S
      }
    } else {
      console.log('No se encontró el accessToken en DynamoDB.');
      return null;
    }
  } catch (error) {
    console.error('Error al obtener el accessToken:', error);
    return null;
  }
}  */

module.exports.receive = async (event) => {
  console.log("evento recibido", event);

  const eventBody = event.body;
  const other = event.pathParameters;

  const client = new LambdaClient({});
  const input = {
    FunctionName: process.env.FUNCTION_NAME,
    InvocationType: "Event",
    Payload: JSON.stringify({ eventBody, other }),
  };
  const command = new InvokeCommand(input);
  const response = await client.send(command);

  console.log(JSON.stringify(response));

  return {
    statusCode: 200,
    body: "Event received successfully!",
  };
};

module.exports.process = async (event) => {
  const body = JSON.parse(event.eventBody);
  const agencyParameters = event.other;

  let agencyCompanyId;

  agencyCompanyId = agencyParameters.agency;

  console.log("agencyParameters",agencyParameters);
  console.log("Body", body);
  console.log("AgencyCompanyId", agencyCompanyId);

  try {
    const eventData = body.data;
    const eventType = body.type;

    agencyId = eventData.after.agencyId;

    console.log("ID Agencia", agencyId);

    try {
      const refreshToken = await getAccessToken(agencyCompanyId,agencyId);

      if (!refreshToken) {
        return "No se encontró el AgencyID en DynamoDB.";
      } else {
        hubspotApiKey = refreshToken;

        console.log("hubspotApiKey", hubspotApiKey);
      }
    } catch (error) {
      console.error("Error durante la ejecución:", error);
    }
    // Creacion de contacto en HubSpot (✅)

    if (eventType === "student:create") {
      try {
        var getOwner = "";

        var ownerId = eventData.after.ownerId;

        let mobileValue = null;

        if (
          eventData.after.customPropertyValues &&
          eventData.after.customPropertyValues.length > 0
        ) {
          // Iterar sobre el array solo si no está vacío
          for (const customPropertyValue of eventData.after
            .customPropertyValues) {
            if (
              customPropertyValue &&
              customPropertyValue.customPropertyFieldId === "mobile"
            ) {
              mobileValue = customPropertyValue.value;
              break;
            }
          }
        } else {
          console.log("El array customPropertyValues está vacío.");
        } 

        let contactData = {
          properties: {
            email: eventData.after.email,
            firstname: eventData.after.firstname,
            lastname: eventData.after.lastname,
            is_deleted: "false",
            studentid: eventData.after.studentId,
            phone: eventData.after.phone,
            countryhs: eventData.after.nationalityId,
            fecha_nacimiento: eventData.after.birthdate,
            id_agency: agencyId,
            mobilephone: mobileValue !== null ? mobileValue : "",
          },
        };

        try {
          console.log("** UPDATE OWNERS - Creacion 1**");

          console.log("Tokens a enviar - hubspotToken", hubspotApiKey);
          console.log("Tokens a enviar - edvisorToken", edvisorAuthToken);

          const client = new LambdaClient();
          const input = {
            FunctionName: process.env.FUNCTION_NAME,
            InvocationType: "RequestResponse",
            Payload: JSON.stringify({
              HUBSPOT_TOKEN: hubspotApiKey,
              EDVISOR_TOKEN: edvisorAuthToken,
            }),
          };
          const command = new InvokeCommand(input);

          console.log("command de owners", command);

          const response = await client.send(command);

          console.log("response de owners", response);

          console.log("id de agencia para buscar", agencyId);

          agencyIdToSearch = agencyId;

          const ownerIdToSearch = ownerId ? ownerId : "";

          console.log("ownerid para pasar", ownerId);

          if (ownerId !== null) {
            getOwner = await getEdvisorOwner(
              `${agencyIdToSearch}`,
              `${ownerIdToSearch}`
            );

            console.log("Valor de getOwner", getOwner);

            if (
              getOwner !== null &&
              getOwner !== undefined &&
              getOwner !== ""
            ) {
              try {
                contactData.properties.hubspot_owner_id = getOwner;
                console.log(
                  "Se encontró un agente con el ownerId proporcionado:",
                  getOwner
                );
              } catch (error) {
                console.log("Error al asignar owner - motivo:", error);
              }
            } else {
              console.log(
                "No se encontró un agente con el ownerId proporcionado."
              );
            }
          } else {
            console.log(
              "eventData.after.ownerId está vacío, no se asignará ningún owner"
            );
          }
        } catch (error) {
          console.log("No se encontro propietario para asginar", error);
        }

        try {
          const searchContactFirst = await axios.post(
            `https://api.hubspot.com/crm/v3/objects/contacts/search`,
            {
              filterGroups: [
                {
                  filters: [
                    {
                      propertyName: "studentid",
                      operator: "EQ",
                      value: eventData.after.studentId,
                    },
                  ],
                },
              ],
            },
            {
              headers: {
                Authorization: `Bearer ${hubspotApiKey}`,
              },
            }
          );

          if (searchContactFirst.data.total > 0) {

            const contactHubSpotID = searchContactFirst.data.results[0].id;

            const updateContact = await axios.patch(
              `https://api.hubspot.com/crm/v3/objects/contacts/${contactHubSpotID}`,
              contactData,
              {
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${hubspotApiKey}`,
                },
              }
            );

            console.log("Contacto ya existente, actualizado");

          } else {
            
            try {

              const response = await axios.post(
                "https://api.hubspot.com/crm/v3/objects/contacts",
                contactData,
                {
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${hubspotApiKey}`,
                  },
                }
              );

              console.log("Contacto creado exitosamente:", response.data);
            } catch (error) {
              console.error("Error al crear contacto, posiblemente ya exista",error);

              //Ultimo Update 19/01/2024

              console.error('No se pudo crear el contacto, probablemente exista, intentando nuevamente',error);

              const string = error.response.data.message

              const match = string.match(/Existing ID: (\d+)/);

              if (match) {

                const existingId = match[1];

                const updateContact = await axios.patch(
                  `https://api.hubspot.com/crm/v3/objects/contacts/${existingId}`,
                  contactData,
                  {
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${hubspotApiKey}`,
                    },
                  }
                );

                console.log(`Contacto actualizado ${existingId} con los siguiente datos ${contactData}`)
                
              } else {
                console.log('No se encontró un ID existente en la cadena.');
              }

            //Ultimo Update 19/01/2024

            }
          }
        } catch (error) {
          console.error("Error crear el contacto", error);
        }
      } catch (error) {
        console.error("Error en creacion", error);
      }
    }

    // Actualización de contactos en HubSpot por studentId (✅)

    if (eventType === "student:update") {
      
      let ownerEdvisor;

      var agencyIdToSearch = "";

      var ownerId;

      try {
        console.log("** UPDATE OWNERS - Actualizacion **");

        console.log("Tokens a enviar - hubspotToken", hubspotApiKey);
        console.log("Tokens a enviar - edvisorToken", edvisorAuthToken);

        const client = new LambdaClient();

        const input = {
          FunctionName: process.env.FUNCTION_NAME,
          InvocationType: "RequestResponse",
          Payload: JSON.stringify({
            HUBSPOT_TOKEN: hubspotApiKey,
            EDVISOR_TOKEN: edvisorAuthToken,
          }),
        };

        const command = new InvokeCommand(input);
        console.log("command de owners", command);
        const response = await client.send(command);
        console.log("response de owners", response);

        var agencyIdToSearch = "";

        ownerId = eventData.after.ownerId;

        console.log("id_agency de payload", agencyId);

        agencyIdToSearch = agencyId;

        console.log("id de agencia para buscar", agencyIdToSearch);

        console.log("ownerId para pasar", ownerId);

        if (ownerId !== null && ownerId !== "" && ownerId !== undefined) {
          const ownerToSearch = ownerId;

          await getEdvisorOwner(`${agencyIdToSearch}`, `${ownerToSearch}`)
            .then((getOwnerId) => {
              if (
                getOwnerId !== null &&
                getOwnerId !== "" &&
                getOwnerId !== undefined
              ) {
                try {
                  console.log(
                    "Se encontró un agente con el ownerId proporcionado async:",
                    getOwnerId
                  );
                  ownerEdvisor = getOwnerId;
                } catch (error) {
                  console.log("Error al asignar owner - motivo:", error);
                }
              } else {
                console.log(
                  "No se encontró un agente con el ownerId proporcionado."
                );
              }
            })
            .catch((error) => {
              console.log("No se encontró propietario para asignar", error);
            });
        } else {
          console.log("OwnerID vacío en el payload");
          ownerId = null;
        }
      } catch (error) {
        console.log("No se encontro propietario para asignar", error);
      }

      let mobileValue = null;

      if (
        eventData.after.customPropertyValues &&
        eventData.after.customPropertyValues.length > 0
      ) {
        // Iterar sobre el array solo si no está vacío
        for (const customPropertyValue of eventData.after
          .customPropertyValues) {
          if (
            customPropertyValue &&
            customPropertyValue.customPropertyFieldId === "mobile"
          ) {
            mobileValue = customPropertyValue.value;
            break;
          }
        }
      } else {
        console.log("El array customPropertyValues está vacío.");
      }

      console.log("ownerEdvisor", ownerEdvisor);

      let contactData = {
        properties: {
          firstname: eventData.after.firstname,
          lastname: eventData.after.lastname,
          studentid: eventData.after.studentId,
          is_deleted: eventData.after.isDeleted,
          phone: eventData.after.phone,
          countryhs: eventData.after.nationalityId,
          fecha_nacimiento: eventData.after.birthdate,
          id_agency: agencyId,
          mobilephone: mobileValue !== null ? mobileValue : "",
          hubspot_owner_id: ownerEdvisor ? ownerEdvisor : null,
        },
      };

      const studentIdToUpdate = eventData.after.studentId; // Obtener el valor de statusid

      // Buscar el contacto en HubSpot por el valor de statusid
      const searchResponse = await axios.post(
        `https://api.hubspot.com/crm/v3/objects/contacts/search`,
        {
          filterGroups: [
            {
              filters: [
                {
                  propertyName: "studentid",
                  operator: "EQ",
                  value: studentIdToUpdate,
                },
              ],
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${hubspotApiKey}`,
          },
        }
      );

      if (searchResponse.data.total > 0) {
        const contactIdToUpdate = searchResponse.data.results[0].id;

        // Actualizar el contacto en HubSpot
        const updateResponse = await axios.patch(
          `https://api.hubspot.com/crm/v3/objects/contacts/${contactIdToUpdate}`,
          contactData,
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${hubspotApiKey}`,
            },
          }
        );

        console.log("Contacto actualizado en HubSpot:", updateResponse.data);
      } else {
        console.log("No se encontró el contacto en HubSpot para actualizar. Se intentara creará uno nuevo");
        //Crear contacto

        var agencyIdToSearch = "";

        var ownerId;

        try {

          console.log("** UPDATE OWNERS - Creacion 2 **");

          console.log("Tokens a enviar - hubspotToken", hubspotApiKey);
          console.log("Tokens a enviar - edvisorToken", edvisorAuthToken);

          const client = new LambdaClient();

          const input = {
            FunctionName: process.env.FUNCTION_NAME,
            InvocationType: "RequestResponse",
            Payload: JSON.stringify({
              HUBSPOT_TOKEN: hubspotApiKey,
              EDVISOR_TOKEN: edvisorAuthToken,
            }),
          };
          const command = new InvokeCommand(input);
          console.log("command de owners", command);
          const response = await client.send(command);
          console.log("response de owners", response);

          var agencyIdToSearch = "";

          ownerId = eventData.after.ownerId;

          console.log("id_agency de payload", agencyId);

          agencyIdToSearch = agencyId;

          console.log("id de agencia para buscar", agencyIdToSearch);

          console.log("ownerId para pasar", ownerId);

          if (ownerId !== null && ownerId !== "" && ownerId !== undefined) {
            const ownerToSearch = ownerId;

            await getEdvisorOwner(`${agencyIdToSearch}`, `${ownerToSearch}`)
              .then((getOwnerId) => {
                if (
                  getOwnerId !== null &&
                  getOwnerId !== "" &&
                  getOwnerId !== undefined
                ) {
                  try {
                    console.log(
                      "Se encontró un agente con el ownerId proporcionado async:",
                      getOwnerId
                    );
                    ownerEdvisor = getOwnerId;
                  } catch (error) {
                    console.log("Error al asignar owner - motivo:", error);
                  }
                } else {
                  console.log(
                    "No se encontró un agente con el ownerId proporcionado."
                  );
                }
              })
              .catch((error) => {
                console.log("No se encontró propietario para asignar", error);
              });
          } else {
            console.log("OwnerID vacío en el payload");
          }
        } catch (error) {
          console.log("No se encontro propietario para asignar", error);
        }

        let mobileValue = null;
        let portalIdValue = null;

        if (
          eventData.after.customPropertyValues &&
          eventData.after.customPropertyValues.length > 0
        ) {
          // Iterar sobre el array solo si no está vacío
          for (const customPropertyValue of eventData.after
            .customPropertyValues) {
            if (
              customPropertyValue &&
              customPropertyValue.customPropertyFieldId === "mobile"
            ) {
              mobileValue = customPropertyValue.value;
              break;
            }
          }
        } else {
          console.log("El array customPropertyValues está vacío.");
        }

        const newContactData = {
          properties: {
            email: eventData.after.email,
            firstname: eventData.after.firstname,
            lastname: eventData.after.lastname,
            studentid: eventData.after.studentId,
            phone: eventData.after.phone,
            countryhs: eventData.after.nationalityId,
            fecha_nacimiento: eventData.after.birthdate,
            id_agency: agencyId,
            mobilephone: mobileValue !== null ? mobileValue : "",
            is_deleted: eventData.after.isDeleted,
            hubspot_owner_id: ownerEdvisor ? ownerEdvisor : null,
          },
        };

        const createContact = await axios.post(
          "https://api.hubspot.com/crm/v3/objects/contacts",
          newContactData,
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${hubspotApiKey}`,
            },
          }
        );

        console.log("Contacto creado:", createContact);

        try {
          const updateStudentEdvisorQuery = `
            mutation{
              upsertStudent(input:{
                studentId:${eventData.after.studentId},
                email:"${eventData.after.email}",
                metadata:{
                  objectId:"${createContact.data.id}",
                  portalid:"${
                    eventData.after.metadata
                      ? eventData.after.metadata.portalid
                      : ""
                  }"
                }
              }){
                email
                studentId
                metadata
              }
            }
        `;

          const updateStudentEdvisor = await edvisorApi.post("/", {
            query: updateStudentEdvisorQuery,
          });

          console.log("Contacto actualizado con StudentId");
        } catch (error) {
          console.log("Error al asginar studentId al contacto creado", error);
        }
      }
    }

    // Borrar contacto en Edvisor y actualizar en HubSpot (✅)

    if (eventType === "student:delete") {
      const contactData = {
        properties: {
          is_deleted: eventData.after.isDeleted,
        },
      };

      const studentIdToUpdate = eventData.after.studentId;

      const searchResponse = await axios.post(
        `https://api.hubspot.com/crm/v3/objects/contacts/search`,
        {
          filterGroups: [
            {
              filters: [
                {
                  propertyName: "studentid",
                  operator: "EQ",
                  value: studentIdToUpdate,
                },
              ],
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${hubspotApiKey}`,
          },
        }
      );

      if (searchResponse.data.total > 0) {
        const contactIdToUpdate = searchResponse.data.results[0].id;

        // Actualizar el contacto en HubSpot
        const updateResponse = await axios.patch(
          `https://api.hubspot.com/crm/v3/objects/contacts/${contactIdToUpdate}`,
          contactData,
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${hubspotApiKey}`,
            },
          }
        );

        console.log("Contacto actualizado en HubSpot:", updateResponse.data);
      } else {
        console.log("No se encontró el contacto en HubSpot para actualizar.");
      }
    }
  } catch (error) {
    console.error("Error al interactuar con HubSpot:", error.response);
  }
};
