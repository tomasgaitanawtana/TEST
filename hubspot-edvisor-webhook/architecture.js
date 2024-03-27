//Busca el accesstoken por portalID que viene en el payload de Hubspot.
//Si el idAgency no viene incluido en el payload, se llama a una funcion asincrona que obtiene el agencyId por defecto.

const axios = require("axios");
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
const {
  SQSClient,
  GetQueueUrlCommand,
  SendMessageCommand,
  GetQueueAttributesCommand,
  ReceiveMessageCommand,
  DeleteMessageBatchCommand
} = require("@aws-sdk/client-sqs");

const { DynamoDBClient, GetItemCommand, UpdateItemCommand } = require("@aws-sdk/client-dynamodb");

const querystring = require('querystring');

let hubspotApiKey;
const edvisorApiUrl = "https://api.edvisor.io/graphql";
let edvisorAuthToken;
let id_agency_default;
let agencyCompanyId;

const QUEUE_NAME = process.env.QUEUE_NAME;
const FUNCTION_NAME = process.env.FUNCTION_NAME;
const TABLE_NAME = process.env.TABLE_NAME;
const TABLE_NAME_TOKEN = process.env.TABLE_NAME_TOKEN;
const UPDATE_FUNCTION_NAME = process.env.UPDATE_FUNCTION_NAME;

// const eventQueue = [];
// const MAX_QUEUE_SIZE = 100; // Tamaño máximo de la cola
// const PROCESS_INTERVAL = 30 * 60 * 1000; // 30 minutos en milisegundos
const edvisorApi = axios.create({
  baseURL: edvisorApiUrl,
  headers: { Authorization: `Bearer ${edvisorAuthToken}`}
});

let primerosElementos = [];

/* async function createContactProperty(contactProperties,hubspotApiKey) {
  try {
    console.log('accestoken -> ',hubspotApiKey);
    const propertyKey = contactProperties.name;
    const existingProperty = await getProperty(propertyKey,hubspotApiKey);

    if (!existingProperty) {
      await axios.post(
        "https://api.hubspot.com/crm/v3/properties/contacts",
        contactProperties,
        {
          headers: {
            Authorization: `Bearer ${hubspotApiKey}`,
            "Content-Type": "application/json",
          },
          params: {
            groupName: contactProperties.groupName, // Agregar el nombre del grupo como parámetro
          },
        }
      );

      console.log("Propiedad de contacto creada:", propertyKey);
    }  else {
      console.log("La propiedad de contacto ya existe:", existingProperty);
    } 
  } catch (error) {
    console.log("Error al crear propiedad de contacto:", error.response.data.message); 
    //await sendEmail(error);
  }
}

async function getProperty(propertyKey,hubspotApiKey) {
  try {
    const response = await axios.get(
      `https://api.hubspot.com/crm/v3/properties/contacts/named/${propertyKey}`,
      {
        headers: {
          Authorization: `Bearer ${hubspotApiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data.results[propertyKey];
  } catch (error) {
    if (error.response.status === 404) {
      return null; // La propiedad no existe
    }
    throw error;
  }
} */

async function createContactProperty(contactProperties, hubspotApiKey) {
  try {
    console.log('accestoken -> ', hubspotApiKey);

    console.log('contactProperties',contactProperties);
    console.log('contactProperties',contactProperties[0]);

    // Verificar si la propiedad ya existe
    const propertyKey = contactProperties[0].name;
    const existingProperty = await getProperty(propertyKey, hubspotApiKey);

    if (!existingProperty) {

      const propertiesData = contactProperties[0];

      const response = await axios.post(
        "https://api.hubspot.com/crm/v3/properties/contacts",
        propertiesData,
        {
          headers: {
            Authorization: `Bearer ${hubspotApiKey}`,
            "Content-Type": "application/json",
          },
          params: {
            groupName: propertiesData.groupName,
          },
        }
      );

      console.log("Propiedad de contacto creada:", response.data);
    } else {
      console.log("La propiedad de contacto ya existe:", existingProperty);
    }
  } catch (error) {
    console.log("Error al crear propiedad de contacto:", error.response.data.message);
    //await sendEmail(error);
  }
}

async function getProperty(propertyKey, hubspotApiKey) {
  try {
    const response = await axios.get(
      `https://api.hubspot.com/crm/v3/properties/contacts/named/${propertyKey}`,
      {
        headers: {
          Authorization: `Bearer ${hubspotApiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data.results[propertyKey];
  } catch (error) {
    if (error.response.status === 404) {
      return null; // La propiedad no existe
    }
    throw error;
  }
}

async function getHubSpotOwner(agencyIdToSearch,ownerToSearch,portalIDToSearch) {
  
  console.log('entro al buscador de getHubSpotOwner');

  console.log('agencyIdToSearch',agencyIdToSearch);
  console.log('ownerToSearch',ownerToSearch);
  console.log('portalIDToSearch',portalIDToSearch);
  
  const client = new DynamoDBClient();
  
  const input = {
    TableName: TABLE_NAME,
    Key: {
      'pk': { 'S' : agencyIdToSearch }, 
      'sk': { 'S' : portalIDToSearch }
    },
  }
  
  const command = new GetItemCommand(input);
  
  console.log('command',command)
  
  try {
    
    console.log('antes de entrar al response')
    
    const response = await client.send(command);
    
    console.log('response 1',response);
    
    if (response.Item) {
      
      const item = response.Item;
      const agents = item.agents.L;
      
      for (const agent of agents) {
        let hubspotOwnerId = agent.M.hubspot_owner_id.S;

        console.log('hubspotOwnerId',hubspotOwnerId);
        
        if (parseInt(hubspotOwnerId) === parseInt(ownerToSearch)) {
          console.log('coincidieron ', hubspotOwnerId, ' y ', ownerToSearch);
          console.log('agent.M.userId.N',agent.M.userId.N)
          return agent.M.userId.N;
        } 
      }

      console.log('No se encontró el agente en DynamoDB');
      return null;
      
    } else {
      console.log('La respuesta de DynamoDB no tiene la estructura esperada.');
      return null;
    }
    
    /* const agentsString = response.Item.agents.S;
    const agents = JSON.parse(agentsString);
    
    console.log('response array', agents);
    
    if (agents) {
      for (const agent of agents) {
        const hubspotOwnerId = agent.M.hubspot_owner_id.S;
        
        if (parseInt(hubspotOwnerId) === parseInt(ownerToSearch)) {
          console.log('coincidieron ', hubspotOwnerId, ' y ', ownerToSearch);
          return agent.M.userId.N;
        }
      }
    } else {
      console.log('no se encontro el propietario');
      return null;
    } */
    
  } catch (error) {
    console.error('Error al obtener el item:', error);
    return null;
  }
}

async function updateTokenInDynamoDB(userIdToSearch, newAccessToken, expiresIn, refreshToken) {
  const client = new DynamoDBClient();
  
  try {
    const expirationTime = new Date(new Date().getTime() + expiresIn * 1000 * 0.75);
    
    const updateItemInput = {
      TableName: TABLE_NAME_TOKEN,
      Key: {
        'pk': { 'S': userIdToSearch.toString() },
        'sk': { 'S': 'NO_ESPECIFICADO'}
      },
      UpdateExpression: 'SET HubID = :accessToken, expires_at = :expirationTime, refresh_token = :refreshToken',
      ExpressionAttributeValues: {
        ':accessToken': { 'S': newAccessToken },
        ':expirationTime': { 'S': expirationTime.toISOString() },
        ':refreshToken': { 'S': refreshToken }
      },
    };
    
    console.log('datos para actulizar en la table',updateItemInput)
    
    await client.send(new UpdateItemCommand(updateItemInput));
    
    console.log('Token actualizado correctamente en DynamoDB.');
    
    return newAccessToken
    
  } catch (error) {
    console.error('Error al actualizar el token en DynamoDB:', error);
  }
}

async function getAccessToken(userIdToSearch) {

  const client = new DynamoDBClient();

  let newAccessToken;
  
  try {

    const getItemInput = {
      TableName: TABLE_NAME_TOKEN,
      Key: {
        'pk': { 'S': userIdToSearch.toString() },
        'sk': { 'S': 'NO_ESPECIFICADO'}
      },
    };

    const response = await client.send(new GetItemCommand(getItemInput));

    console.log('response',response.Item);

    if (response.Item && response.Item.expires_at) {

      edvisorAuthToken = response.Item.edvisor_token.S;
      agencyCompanyId = response.Item.agencyCompanyId.S;
      id_agency_default = response.Item.id_agency_default.S;
      console.log('edvisorToken',edvisorAuthToken);
      console.log('agencyCompanyId',agencyCompanyId);
      console.log('id_agency_default',id_agency_default);

      const expirationTime = new Date(response.Item.expires_at.S);

      if (expirationTime.getTime() < Date.now()) {

          console.log('la fecha de expiracion esta vencida')

          const refreshToken = response.Item.refresh_token.S;

          console.log('Refresh_token anterior',refreshToken);
          console.log('Acces_token anterior',response.Item.HubID.S);
          console.log('Expires_at anterior',response.Item.expires_at.S);
    
          // Realizar la solicitud de refresco del token utilizando el refreshToken
          const tokenUrl = 'https://api.hubapi.com/oauth/v1/token';
          const data = {
            grant_type: 'refresh_token',
            client_id: process.env.CLIENT_ID,
            client_secret: process.env.CLIENT_SECRET,
            refresh_token: refreshToken,
          };

          let newExpiresIn;
          let newRefreshToken;

          try {

            console.log('Por actualizar refresh_token...')

            const refreshResponse = await axios.post(tokenUrl, querystring.stringify(data), {
              headers: {
                  'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
              },
              });
          
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
          const accessTokenDynamo = await updateTokenInDynamoDB(userIdToSearch, newAccessToken, newExpiresIn, newRefreshToken);

          return accessTokenDynamo
      } else {
        console.log('la fecha de expiracion se encuentra vigente')
        return response.Item.HubID.S
      }
    }

    console.error('No se encontró el accessToken en DynamoDB.');

    return null;
  } catch (error) {
    console.error('Error al obtener el accessToken:', error);
    return null;
  }
}

async function getAgencyIdDefault(userIdToSearch) {

  const client = new DynamoDBClient();
  
  try {

    const getItemInput = {
      TableName: TABLE_NAME_TOKEN,
      Key: {
        'pk': { 'S': userIdToSearch.toString() },
        'sk': { 'S': 'NO_ESPECIFICADO'}
      },
    };

    const response = await client.send(new GetItemCommand(getItemInput));

    if (response.Item && response.Item.id_agency_default) {

      id_agency_default = parseInt(response.Item.id_agency_default.S);
      console.log('id_agency_default',id_agency_default);
      
      return id_agency_default
    } 

    console.error('No se encontró el id_agency_default en DynamoDB.');

    return null;
  } catch (error) {
    console.error('Error al obtener el id_agency_default:', error);
    return null;
  }
}

module.exports.receive = async (event) => {
  try {
    const eventBody = JSON.parse(event.body);
    console.log('Evento:', eventBody);

   const sqsClient = new SQSClient({});
    const getQueueUrl = new GetQueueUrlCommand({
      QueueName: QUEUE_NAME
    });
    const { QueueUrl } = await sqsClient.send(getQueueUrl);

    const sendMessage = new SendMessageCommand({
      QueueUrl,
      MessageBody: JSON.stringify(eventBody)
    });

    await sqsClient.send(sendMessage);

    const lambdaClient = new LambdaClient({});

    const invokeFunction = new InvokeCommand({
      FunctionName: FUNCTION_NAME,
      InvocationType: 'Event',
      Payload: JSON.stringify({ queueUrl: QueueUrl }) 
    });

    const response = await lambdaClient.send(invokeFunction);
    
    console.log(response);

    return {
      statusCode: 200,
      body: 'PROCESS - Event received successfully!',
    };
    
  } catch (error) {
      console.error("PROCESS - Error al recibir el evento:", error);
      return {
        statusCode: 500,
        body: 'PROCESS - Error interno al recibir el evento.',
      };
  }
};

module.exports.process = async (event) => {
  const { queueUrl } = event;
  console.log('Waiting 1 min...');
  await new Promise(r => setTimeout(r, 60000)); // Esperar un minuto para estabilizar mensajes

  const client = new SQSClient({});
  const getQueueAttributes = new GetQueueAttributesCommand({
    QueueUrl: queueUrl,
    AttributeNames: ['ApproximateNumberOfMessages']
  });
  const { Attributes } = await client.send(getQueueAttributes);

  let capturedEvents = [];
  let messages = [];

  console.log(Attributes);

  if (parseInt(Attributes.ApproximateNumberOfMessages) >= 1) {

    const waitTimeSeconds = 5;

    while (messages.length < parseInt(Attributes.ApproximateNumberOfMessages)) {

      const receiveMessage = new ReceiveMessageCommand({
        QueueUrl: queueUrl,
        MaxNumberOfMessages: 10
      });

      try {

        const response = await client.send(receiveMessage);

        console.log(response);
        
        if (response.Messages && response.Messages.length > 0) {

          messages = messages.concat(response.Messages);

        } else {
            console.log('Mensajes sin body')
          }

      } catch(error){
        console.error('Error al recibir mensajes de la cola SQS:',error)
      }

      await new Promise(resolve => setTimeout(resolve, waitTimeSeconds * 1000));

    }

    for (const message of messages) {

      if (message.Body) {
        capturedEvents = capturedEvents.concat(JSON.parse(message.Body));
      } else {
        console.log('mensaje vacío');
      }
    }

    if (capturedEvents.length === 0) {
      console.log('No hay eventos capturados, deteniendo la ejecución del código.');
      return; 
    }

    console.log('PDP - Eventos recibidos para procesar:', capturedEvents);

  }
    const groupedByObjectId = {};

    console.log('---ACCESS TOKEN---')

    console.log('Evento',capturedEvents);
    console.log('Eventos',capturedEvents[0]);

    const userIdToSearch = capturedEvents[0].portalId;
    
    console.log('PortalID',userIdToSearch)

    const refreshToken = await getAccessToken(userIdToSearch);

    hubspotApiKey = refreshToken; 
    
    console.log('hubspotApiKey',hubspotApiKey);
    console.log('edvisorToken',edvisorAuthToken);
    console.log('agencyCompanyId',agencyCompanyId);
    console.log('id_agency_default',id_agency_default);

    capturedEvents.forEach((item) => {
      const objectId = item.objectId;
      if (!groupedByObjectId[objectId]) {
        groupedByObjectId[objectId] = [];
      }
      groupedByObjectId[objectId].push(item);
    });
    const arrayOfArrays = Object.values(groupedByObjectId);

    // Función de comparación personalizada para ordenar por occurredAt
    const compararPorOccurredAt = (a, b) => {
      return a[0].occurredAt - b[0].occurredAt;
    };

    arrayOfArrays.sort(compararPorOccurredAt);

    console.log('array de arrays',arrayOfArrays);

    //aca arranca el codigo

    await processWebhookEvent(arrayOfArrays);

    async function processWebhookEvent(events) {
      for (const eventGroup of events) {
        const primerElemento = eventGroup[0]
        console.log('primer elemento',primerElemento);
        
        //for (const event of eventGroup) {
          const objectId = primerElemento.objectId; // Obtén el valor correcto de objectId de cada evento

          console.log('objectid',objectId);
          console.log('event',event);
          try {

            try {

              console.log('----- ACTUALIZACION ----- ');

              console.log('Access token para buscar el portal',hubspotApiKey);

              console.log('portalId',userIdToSearch);

              try {

                const client = new DynamoDBClient();

                const input = {
                  TableName: TABLE_NAME_TOKEN,
                  Key: {
                    pk: { S: `${userIdToSearch}` },
                    sk: { S: 'NO_ESPECIFICADO'}
                  },
                };

                const command = new GetItemCommand(input);

                console.log("command", command);

                try{

                  const response = await client.send(command);

                  console.log("response 1", response);

                  if (response.Item) {
                    agencyCompanyId = response.Item.id_agency_default.S;
                    edvisorAuthToken = response.Item.edvisor_token.S;
                    console.log('agencyCompanyId', agencyCompanyId);
                    console.log('edvisorAuthToken', edvisorAuthToken);
                  } else {
                    console.log('No se encontró ningún elemento con la clave primaria proporcionada.');
                  }

                } catch(error){
                  console.error('Error al obtener el response',error);
                }

              } catch(error){
                console.error('Error al buscar los valores');
              }

                console.log('edvisorToken',edvisorAuthToken)

                const getAgencies = await axios.post(
                  edvisorApiUrl,
                  {
                    query: `
                    query{
                      agencies{
                        name
                        agencyId
                        agencyCompanyId
                      }
                    }
                    `,
                  },
                  {
                    headers: {
                      Authorization: `Bearer ${edvisorAuthToken}`,
                    },
                  }
                );

                const valores = getAgencies.data.data.agencies.map(agency => agency.agencyId);
                const nombresAgencias = getAgencies.data.data.agencies.map(agency => agency.name);

                console.log('valores',valores)

                const contactProperties = [
                  {
                    name: "id_agency",
                    label: "ID de Agencia",
                    type: "enumeration",
                    fieldType: "select",
                    groupName: "contacts-edvisor",
                    displayOrder: 4,
                    options: [],
                  }
                ];

                valores.forEach((valor, index) => {

                    const nombreAgencia = nombresAgencias[index];

                    const option = {
                        label: `${nombreAgencia}`,
                        description: `Choice number ${index + 1}`,
                        value: valor,
                        displayOrder: index + 1,
                        hidden: false,
                    };
                    contactProperties[0].options.push(option);
                });

                try{

                  console.log('ContactProperties',contactProperties);
                  
                  await createContactProperty(contactProperties,hubspotApiKey)

                  console.log('Porpiedad creada')

                } catch(error){
                  console.error('Error al crear la porpiedad',error)
                }

            } catch(error){
              console.error('Error al actualizar la propiedad de contacto',error)
            } 

            const searchResponse = await axios.post(
              `https://api.hubspot.com/crm/v3/objects/contacts/search`,
              {
                filterGroups: [
                  {
                    filters: [
                      {
                        propertyName: "hs_object_id",
                        operator: "EQ",
                        value: objectId, // Utiliza el valor de objectId en la solicitud
                      },
                    ],
                  },
                ],
                properties: ["studentid","firstname","lastname","email","id_agency","phone","mobilephone","hubspot_owner_id","countryhs","fecha_nacimiento","hs_object_id"],
              },
              {
                headers: {
                  Authorization: `Bearer ${hubspotApiKey}`,
                },
              }
            );
    
            if (searchResponse.data.total > 0) {

              if (searchResponse.data.results[0].properties.studentid){
                console.log('Contacto encontrado y su studentid es',searchResponse.data.results[0].properties.studentid)
              } else {
                console.log('Contacto sin studentId cargado');
              }
        
              let firstName = searchResponse.data.results[0].properties.firstname;
              let lastName = searchResponse.data.results[0].properties.lastname;
              let email = searchResponse.data.results[0].properties.email;
              let id_agency = searchResponse.data.results[0].properties.id_agency;
              let phone = searchResponse.data.results[0].properties.phone;
              let mobilephone = searchResponse.data.results[0].properties.mobilephone;
              let ownerId = searchResponse.data.results[0].properties.hubspot_owner_id;
              let countryhs = searchResponse.data.results[0].properties.countryhs;
              let fecha_nacimiento = searchResponse.data.results[0].properties.fecha_nacimiento;
              let hsObjectId = searchResponse.data.results[0].properties.hs_object_id;
              var getOwnerId = '';

              console.log('datos del contacto',searchResponse.data.results[0].properties);

              if (fecha_nacimiento != null){

                const fechaString = fecha_nacimiento;
                const timestamp = parseInt(fechaString);
                const fecha = new Date(timestamp);
                const year = fecha.getFullYear();
                const month = String(fecha.getMonth() + 1).padStart(2, '0'); 
                const day = String(fecha.getDate()).padStart(2, '0');
                formattedDate = `${year}-${month}-${day}`;
      
              } else {
                formattedDate = '';
              }

              let ownerEdvisor = null;

                console.log('-- Update Owners ');

                console.log('Tokens a enviar - hubspotToken',hubspotApiKey);
                console.log('Tokens a enviar - edvisorToken',edvisorAuthToken);

                const client = new LambdaClient();
                
                const input = { 
                  FunctionName: UPDATE_FUNCTION_NAME,
                  InvocationType: "RequestResponse",
                  Payload: JSON.stringify({
                    HUBSPOT_TOKEN: hubspotApiKey,
                    EDVISOR_TOKEN: edvisorAuthToken,
                  }),
                };

                try {

                  const command = new InvokeCommand(input);

                  const response = await client.send(command);

                  console.log(JSON.stringify(response));
                
                  console.log('Response de owners', response);

                } catch (error) {
                  console.error('Error al invocar la función', error);
                }
          
                try {
                
                  console.log('id_agency de payload',id_agency);
        
                  agencyIdToSearch = id_agency !== null ? parseInt(id_agency) : await getAgencyIdDefault(userIdToSearch);;
        
                  console.log('id de agencia para buscar', agencyIdToSearch);
        
                  if (ownerId !== null && ownerId !== '' && ownerId !== undefined) {
        
                    console.log('ownerId para pasar',ownerId);

                    const ownerToSearch = ownerId;

                    console.log('owner antes de la funcion (debe se null)',ownerEdvisor);
        
                    await getHubSpotOwner(`${agencyIdToSearch}`, `${ownerToSearch}`,`${userIdToSearch}`)
                    .then(getOwnerId => {
                      if (getOwnerId !== null && getOwnerId !== '' && getOwnerId !== undefined) {
                        try {
                          console.log('Se encontró un agente con el ownerId proporcionado async:', getOwnerId);
                          ownerEdvisor = getOwnerId;
                          console.log('owner asignado en la funcion',ownerEdvisor);
                        } catch(error){
                          console.log('Error al asginar owner - motivo:',error)
                          ownerEdvisor = null;
                        }
                      } else {
                        console.log('No se encontró un agente con el ownerId proporcionado.');
                        ownerEdvisor = null;
                      }
                    })
                    .catch(error => {
                      console.log('No se encontró propietario para asignar', error);
                      ownerEdvisor = null;
                    });
                  } else {
                    console.log('OwnerID vacío en el payload');
                    ownerEdvisor = null;
                  }
                } catch(error){
                  console.error('Error en la busqueda/asginacion de propietarios',error)
                  ownerEdvisor = null;
                }

              console.log('Portal ID a asignar',userIdToSearch);

              console.log('EdvisorToken',edvisorAuthToken);
              console.log('HubSpotToken',hubspotApiKey);

              console.log('Owner a asignar',ownerEdvisor);

              const createStudentQuery = `
                mutation {
                  upsertStudent(input: {
                    firstname: "${firstName ? firstName : "no-firstname"}",
                    lastname: "${lastName ? lastName : "no-lastname"}",
                    email: "${email}",
                    agencyId: ${id_agency !== null ? parseInt(id_agency) : await getAgencyIdDefault(userIdToSearch)},
                    nationalityId: ${countryhs ? countryhs : 46},
                    phone: "${phone ? phone : ''}",
                    ${ownerEdvisor ? 'ownerId: ' + ownerEdvisor + ',' : 'ownerId:' + null},
                    metadata: {
                      objectId: "${hsObjectId ? hsObjectId : '' }",
                      portalid: "${userIdToSearch ? userIdToSearch : '' }",
                    },
                    ${formattedDate ? 'birthdate: "' + formattedDate + '",' : ''}
                    customPropertyValues: 
                    {
                      action: upsert,
                      data:{
                        customPropertyFieldId:"mobile",
                        value: "${mobilephone ? mobilephone : '' }"
                      } 
                    }
                  }
                  ) {
                    studentId
                    firstname
                    lastname
                    email
                    metadata
                    nationalityId
                    phone
                    ${formattedDate ? 'birthdate' : '' }
                    ${ownerEdvisor ? 'ownerId' : '' }
                    agencyId
                    customPropertyValues{
                      customPropertyFieldId
                      value
                    }
                  }
                }
                `;

              console.log('createStudentQuery',createStudentQuery);

              try {

                const createStudentResponse = await axios.post(edvisorApiUrl, { query: createStudentQuery }, { headers: { Authorization: `Bearer ${edvisorAuthToken}` } });

                console.log('createStudentResponse',createStudentResponse);

                const createdStudent = JSON.stringify(createStudentResponse.data);

                console.log('Contacto Creado en Edvisor:',createdStudent);

                var objetoJSON = JSON.parse(createdStudent);

                console.log('ObjetoJSON',objetoJSON);

                // Acceder al valor de studentId
                var student_id = objetoJSON.data.upsertStudent.studentId;
                var hs_objectId = objetoJSON.data.upsertStudent.metadata.objectId;
                var idToSearch = parseInt(hs_objectId);

                console.log('studentid a agregar',student_id);
                      
                try{
                  
                  const contactData = {
                    properties: {
                      studentid: student_id,
                      hsportalid: userIdToSearch
                    }
                  }
            
                  const updateHSContact = await axios.patch(
                    `https://api.hubspot.com/crm/v3/objects/contacts/${idToSearch}`,
                    contactData,
                    {
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${hubspotApiKey}`,
                      },
                    }
                  );

                  console.log('StudentID agregado al contacto',updateHSContact);

                } catch(error){
                    console.log('Error al agregar StudentId al contacto',error);
                }

              } catch(error){
                console.error('Error al crear el contacto en Edvisor')
              }

              //Eliminacion

              if(searchResponse.data.results[0].properties.is_deleted === true){
                //eliminar en Edvisor

                try {

                  const deleteStudentQuery = `
                  query{
                    studentsList
                    {
                      data {
                        email
                        studentId
                        metadata
                      }
                    }
                  }
                  `;

                  const deleteStudentResponse = await edvisorApi.post('/', {
                    query: deleteStudentQuery,
                  });

                  const arrayResponse = deleteStudentResponse.data.data.studentsList.data;

                  for (let i = 0; i < arrayResponse.length; i++) {
                    const objectIdFound = arrayResponse[i].metadata.objectId;
                    const studentId = arrayResponse[i].studentId;

                    if (objectIdFound === String(hsobjectId)) {
                        //elimina
                        const deleteStudentQuery = `
                        mutation {
                          deleteStudents(studentIds: [${studentId}]) {
                            studentId
                          }
                        }
                        `;

                        const deleteStudentResponse = await axios.post(edvisorApiUrl, { query: deleteStudentQuery }, { headers: { Authorization: `Bearer ${edvisorAuthToken}` } });

                        console.log('Estudiante eliminado');
                        console.log(deleteStudentResponse.data.data.deleteStudents);
                    } else {
                        console.log('Contacto no encontrado, no es posible eliminar')
                    }
                  }

                } catch(error){
                  console.error('Error al eliminar contacto en Edvisor',error)
                }
                
              } 

            } else {
              console.log('Contacto no encontrado en HubSpot');
            }
          } catch (error) {
            console.log('Error', error);
          }
        //}
      }
    }
    
    
  if (capturedEvents.length > 0) {
    const deleteMessages = new DeleteMessageBatchCommand({
      QueueUrl: queueUrl,
      Entries: messages.map(({ MessageId, ReceiptHandle }) => ({
        Id: MessageId,
        ReceiptHandle
      }))
    });
    const { Successful, Failed } = await client.send(deleteMessages);
    console.log('Successfully deleted', Successful)
    console.log('Failed to delete', Failed)
  } else {

      //console.log('No hay eventos capturados, deteniendo la ejecución del código.');
    
      const maxRetentionTime = 12 * 60 * 60; // 12 horas en segundos
    
      const elapsedTime = (Date.now() - new Date(event.ReceivedTimestamp * 1000).getTime()) / 1000;
      
      if (elapsedTime < maxRetentionTime) {
        const remainingTime = maxRetentionTime - elapsedTime;
        console.log(`Esperando ${remainingTime} segundos antes de eliminar mensajes.`);
        await new Promise(resolve => setTimeout(resolve, remainingTime * 1000));
      }
    
      if (elapsedTime >= maxRetentionTime) {
        const deleteMessages = new DeleteMessageBatchCommand({
          QueueUrl: queueUrl,
          Entries: messages.map(({ MessageId, ReceiptHandle }) => ({
            Id: MessageId,
            ReceiptHandle
          }))
        });
    
        const { Successful, Failed } = await client.send(deleteMessages);
        console.log('Successfully deleted', Successful);
        console.log('Failed to delete', Failed);
      }
    }
};