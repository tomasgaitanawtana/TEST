
// agencyId equivalent to idAgencyCompany

const { DynamoDBClient, UpdateItemCommand } = require("@aws-sdk/client-dynamodb");

const TABLE_NAME_TOKEN = process.env.TABLE_NAME;
const REDIRECT_URL = process.env.REDIRECT_URL;
const REDIRECT_URL_ERROR = process.env.REDIRECT_URL_ERROR;

async function updateTokenInDynamoDB(hubspotId, edvisortoken, agencyDefaultId, agencyCompanyId, pipeline, dealstage, template_id, cliente_name) {

  const client = new DynamoDBClient();

  try {

    console.log('Datos para cargar');
    console.log('hubspotId',hubspotId)
    console.log('edvisortoken',edvisortoken)
    console.log('agencyDefaultId',agencyDefaultId)
    console.log('agencyCompanyId',agencyCompanyId)
    console.log('pipeline',pipeline)
    console.log('dealstage',dealstage)
    console.log('template_id',template_id)
    console.log('cliente_name',cliente_name)
    
    const updateItemInput = {
      TableName: TABLE_NAME_TOKEN,
      Key: {
        'pk': { 'S': hubspotId.toString() },
        'sk': {'S': 'NO_ESPECIFICADO'},
      },
      UpdateExpression: 'SET edvisor_token = :edvisor_token, id_agency_default = :id_agency_default , agencyCompanyId = :agencyCompanyId, pipeline = :pipeline, dealstage = :dealstage, template_id = :template_id, cliente_name = :cliente_name',
      ExpressionAttributeValues: {
        ':edvisor_token': { 'S': edvisortoken },
        ':id_agency_default': { 'S': agencyDefaultId },
        ':agencyCompanyId': { 'S': agencyCompanyId },
        ':pipeline': { 'S': pipeline },
        ':dealstage': { 'S': dealstage },
        ':template_id': { 'S': template_id },
        ':cliente_name': { 'S': cliente_name }
      },
    };
    
    await client.send(new UpdateItemCommand(updateItemInput));
    
    return 'successfully'
    
  } catch (error) {
    console.error('Error al actualizar el token en DynamoDB:', error);
  }
}

module.exports.process = async (event) => {

    const requestBody = JSON.parse(event.body);

    const { hubspotId, edvisortoken, agencyDefaultId, agencyCompanyId, pipeline, dealstage, template_id, cliente_name } = requestBody;

    try {
        //guardar los tokens de acceso

        const accessTokenAdded = await updateTokenInDynamoDB(hubspotId, edvisortoken, agencyDefaultId, agencyCompanyId, pipeline, dealstage, template_id, cliente_name);


        if (!accessTokenAdded) {
          return {
            statusCode: 302,
            headers: {
                'Location': REDIRECT_URL_ERROR,
            },
          };
        }

        return {
            statusCode: 302, // 302 es el código de redirección temporal
            headers: {
              'Location': REDIRECT_URL, // Especifica la URL de redirección
            },
          };

    } catch (error) {
        console.error('Error al agregar tokens de acceso', error);

        return {
            statusCode: 302,
            headers: {
                'Location': REDIRECT_URL_ERROR,
            },
        }
    }
} 