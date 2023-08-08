import { $query, $update, Record, StableBTreeMap, Vec, match, Result, nat64, ic, Opt, Principal } from 'azle';
import { v4 as uuidv4 } from 'uuid';

/**
 * This type represents A proposal that will be created in our dao.
 */
type Proposal = Record<{
    owner: Principal; // owner of proposal
    id: string; // id of proposal
    title: string; // title of proposal
    description: string; // description of proposal
    voters: Vec<string>; // list of voters
    yesVotes: number; // number of yesVotes of proposal
    noVotes: number; // number of noVotes of proposal
    created_at: nat64; // time stamp of the creation of the proposal
    updated_at: Opt<nat64>; // // updated time stamp 
}>


//define a Record to store the user input when creating a new proposal
type ProposalPayload = Record<{
    title: string;
    description: string;
}>

/**
 * `proposalStorage` - it's a key-value datastructure that is used to store proposal.
 * {@link StableBTreeMap} is a self-balancing tree that acts as a durable data storage that keeps data across canister upgrades.
 * For the sake of this contract we've chosen {@link StableBTreeMap} as a storage for the next reasons:
 * - `insert`, `get` and `remove` operations have a constant time complexity - O(1)
 * 
 * Brakedown of the `StableBTreeMap<string, Proposal>` datastructure:
 * - the key of map is a `proposalId`
 * - the value in this map is a post itself `proposal` that is related to a given key (`proposalId`)
 * 
 * Constructor values:
 * 1) 0 - memory id where to initialize a map
 * 2) 44 - it's a max size of the key in bytes (size of the uuid value that we use for ids).
 * 3) 1024 - it's a max size of the value in bytes. 
 * 2 and 3 are not being used directly in the constructor but the Azle compiler utilizes these values during compile time
 */
const proposalStorage = new StableBTreeMap<string, Proposal>(0, 44, 1024);

/**
 * retrive all proposals
 *  */ 

$query;
export function getProposals(): Result<Vec<Proposal>, string> {
    return Result.Ok(proposalStorage.values());
}


/**
 * retrive proposal by Id
 *  */ 

$query;
export function getProposal(id: string): Result<Proposal, string> {
    return match(proposalStorage.get(id), {
        Some: (proposal) => Result.Ok<Proposal, string>(proposal),
        None: () => Result.Err<Proposal, string>(`a proposal with id=${id} not found`)
    });
}


/**
 * 
 * creating a new proposal
 * 
 *  */ 
$update;
export function createProposal(payload: ProposalPayload): Result<Proposal, string> {

    const { title, description } = payload;

     // Input validation
     if ( !title || !description ) {
        return Result.Err<Proposal, string>('Missing required fields');
    }

    const proposal: Proposal = { 
        owner: ic.caller(),
        id: uuidv4(),
        title, 
        description,
        voters: [],
        yesVotes: 0,
        noVotes: 0,
        created_at: ic.time(), 
        updated_at: Opt.None
       
    };
    
    proposalStorage.insert(proposal.id, proposal);
    return Result.Ok(proposal);
}


/**
 * Users can vote yes for a proposal
*/ 
$update
export function voteYes(id: string): Result<Proposal, string> {
    return match(proposalStorage.get(id), {
        Some: (proposal) => {
           /** 
            // if it is the owner, return an error
            if(proposal.owner.toString() === ic.caller().toString()){
                return Result.Err<Proposal, string>("Owners cannot vote for their own proposal")
            }
            */

            const hasVoted = Array.from(proposal.voters.values()).filter((proposal) => proposal.toString() === ic.caller().toString());

            if(hasVoted.length > 0){
                return Result.Err<Proposal, string>("Already voted")
            }
            
            // if all checks have passed, increase the yesVotes by 1 and the updated_at property to the current timestamp
            const updatedProposal: Proposal = {...proposal, yesVotes: proposal.yesVotes + 1, updated_at: Opt.Some(ic.time())}
            proposalStorage.insert(proposal.id, updatedProposal)
            return Result.Ok<Proposal, string>(updatedProposal)
        },
        None: () => Result.Err<Proposal, string>(`couldn't update a proposal with id=${id}. proposal not found`)
    })
}


/**
 * Users can vote no for a proposal
*/ 
$update
export function voteNo(id: string): Result<Proposal, string> {
    return match(proposalStorage.get(id), {
        Some: (proposal) => {
           
           
           /*
           
           // if it is the owner, return an error
            if(proposal.owner.toString() === ic.caller().toString()){
                return Result.Err<Proposal, string>("Owners cannot vote for their own proposal")
            }

            */

            const hasVoted = Array.from(proposal.voters.values()).filter((proposal) => proposal.toString() === ic.caller().toString());

            if(hasVoted.length > 0){
                return Result.Err<Proposal, string>("Already voted")
            }
            
            // if all checks have passed, increase the noVotes by 1 and the updated_at property to the current timestamp
            const updatedProposal: Proposal = {...proposal, noVotes: proposal.noVotes + 1, updated_at: Opt.Some(ic.time())}
            proposalStorage.insert(proposal.id, updatedProposal)
            return Result.Ok<Proposal, string>(updatedProposal)
        },
        None: () => Result.Err<Proposal, string>(`couldn't update a proposal with id=${id}. proposal not found`)
    })
}

 /**
  * updating a proposal
  *  */ 
$update;
export function updateProposal(id: string, payload: ProposalPayload): Result<Proposal, string> {
    return match(proposalStorage.get(id), {
        Some: (proposal) => {
            const updatedProposal: Proposal = {...proposal, ...payload, updated_at: Opt.Some(ic.time())};
            proposalStorage.insert(proposal.id, updatedProposal);
            return Result.Ok<Proposal, string>(updatedProposal);
        },
        None: () => Result.Err<Proposal, string>(`couldn't update a proposal with id=${id}. proposal not found`)
    });
}


/**
 * deleting a proposal
 */
$update;
export function deleteProposal(id: string): Result<Proposal, string> {
    return match(proposalStorage.remove(id), {
        Some: (deletedProposal) => Result.Ok<Proposal, string>(deletedProposal),
        None: () => Result.Err<Proposal, string>(`couldn't delete a proposal with id=${id}. proposal not found.`)
    });
}

// a workaround to make uuid package work with Azle
globalThis.crypto = {
    getRandomValues: () => {
        let array = new Uint8Array(32);

        for (let i = 0; i < array.length; i++) {
            array[i] = Math.floor(Math.random() * 256);
        }

        return array;
    }
};
