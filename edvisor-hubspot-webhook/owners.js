const axios = require('axios');
const { DynamoDBClient, PutItemCommand, UpdateItemCommand } = require('@aws-sdk/client-dynamodb');
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb');

module.exports.handler = async (event) => {

  const { HUBSPOT_TOKEN, EDVISOR_TOKEN } = event;

  console.log('Token HubSpot',HUBSPOT_TOKEN);
  console.log('Token Edvisor',EDVISOR_TOKEN);

const edvisor = axios.create({
  baseURL: 'https://api.edvisor.io/graphql',
  headers: {
    Authorization: `Bearer ${EDVISOR_TOKEN}`
  }
});
const hubspot = axios.create({
  baseURL: 'https://api.hubapi.com',
  headers: {
    Authorization: `Bearer ${HUBSPOT_TOKEN}`
  }
});

  const date = new Date().toISOString();

  let query = `query {
    agencies {
      agencyId
      agents {
        userId
      }
    }
  }`;
  let response = await edvisor.post('/', { query });

  const agencies = response.data.data.agencies;

  query = `query {
    users {
      userId
      email
    }
  }`;
  response = await edvisor.post('/', { query });
  const users = response.data.data.users;

  response = await hubspot.get('/crm/v3/owners');
  const owners = response.data.results;

  response = await hubspot.get('/account-info/v3/details');
  const portalId = response.data.portalId;

  try {

  const client = new DynamoDBClient({});

  const command = new QueryCommand({
    TableName: process.env.TABLE_NAME,
    IndexName: 'sk-index', 
    KeyConditionExpression: 'sk = :sk',
    ExpressionAttributeValues: { ':sk': { S: portalId.toString() } }
  });

  const queryResponse = await client.send(command);

  // Procesar los datos obtenidos
  const currentIds = queryResponse.Items.map((item) => unmarshall(item).pk);
  const currentPortalIds = queryResponse.Items.map((item) => unmarshall(item).sk);

  /* let command = new ScanCommand({
    TableName: process.env.TABLE_NAME,
    FilterExpression: 'sk = :sk',
    ExpressionAttributeValues: { ':sk': { S: portalId.toString() } }
  });

  const tableData = await client.send(command); //almacenamiento de los datos obtenidos

  const currentIds = tableData.Items.map((item) => unmarshall(item).pk); //almacenamiento de las claves primarias pk
  const currentPortalIds = tableData.Items.map((item) => unmarshall(item).sk); //almacenamiento de las claves primarias sk
 */

  agencies.forEach( async (agency) => {
    agency.agents.forEach((agent) => {

      const user = users.find((user) => user.userId === agent.userId); 
      if (user) {

        agent.email = user.email;

        const owner = owners.find((owner) => owner.email === user.email);

        if (owner) {
          agent.hubspot_owner_id = owner.id;
        } else {
          agent.hubspot_owner_id = null;
        }
      } else {
        agent.email = null;
        agent.hubspot_owner_id = null;
      }
    });

    if (!currentIds.includes(agency.agencyId.toString()) && !currentPortalIds.includes(portalId.toString())) {

      try {

        console.log(`agencyId ${agency.agencyId} no se encontró y se agregará` );

        command = new PutItemCommand({
          TableName: process.env.TABLE_NAME,
          Item: marshall({
            pk: agency.agencyId.toString(),
            sk: portalId.toString(),
            agents: agency.agents,
            date_created: date,
            date_updated: date
          })
        });

        await client.send(command);

        console.log(`Datos agregados correctamente para agencyId ${agency.agencyId}`);

      } catch(error){
        console.error(`Error al agregar ${agency.agencyId}`,error)
      }
    } 

      try {

        command = new UpdateItemCommand({
          TableName: process.env.TABLE_NAME,
          Key: marshall({
            pk: agency.agencyId.toString(),
            sk: portalId.toString(),
            agents: agency.agents,
            date_created: date
          }),
          UpdateExpression: 'SET agents = :agents',
          ExpressionAttributeValues: marshall({ ':agents': agency.agents })
        });
  
        await client.send(command);
  
        console.log(`Datos actualizados correctamente`);

      } catch(error){
        console.error(`Error al actualizar datos`,error)
      }
  });

} catch(error){

  console.error('Error al enviar datos a DynamoDB',error);

  return {
    statusCode: 500,
    body: 'Error interno al recibir el evento',
  };

}
return {
  statusCode: 200,
  body: 'Event received successfully!'
};
};
