%% MAT-fem_Beams
% 2 Nodes Beam using Euler Bernoulli Theory 

% Clear memory and variables
  clear
  
% The variables are read as a MAT-fem subroutine
% young   = Young Modulus
% poiss   = Poission Ratio
% denss   = Material density 
% area    = Cross section area
% inertia = Cross section inertia
% coordinates = [ x ] matrix size: nnode x ndime (1)
% elements    = [ inode , jnode ] element connectivity matrix.
%               Matrix size: nelem x nnode; nnode = 2 
% fixnodes    = [ node number , dof , fixed value ] matrix with 
%               Dirichlet restrictions, were dof=1 for vertical 
%               displacement and dof=2 for vertical derivative
% pointload   = [ node number , dof , load value ] matrix with 
%               nodal loads, were dof=1 for vertical load 
%               and dof=2 for moment
% uniload     = [ uniform vertical load ] sparse matrix size: nelem x 1

  file_name = input('Enter the file name: ','s');

  tic;                   % Start clock
  ttim = 0;              % Initialize time counter
  eval(file_name);       % Read input file

% Find basic dimensions
  npnod = size(coordinates,1);         % Number of nodes
  nelem = size(elements,1);            % Number of elements
  nnode = size(elements,2);            % Number of nodes por element
  dofpn = 2;                           % Number of DOF per node
  dofpe = nnode*dofpn;                 % Number of DOF per element
  nndof = npnod*dofpn;                 % Number of total DOF 

  ttim = timing('Time needed to read the input file',ttim); %Reporting time

% Dimension the global matrices
  StifMat  = sparse( nndof , nndof );  % Create the global stiffness matrix
  force    = sparse( nndof , 1 );      % Create the global force vector
  force1   = sparse( nndof , 1 );      % Create the global force vector
  reaction = sparse( nndof , 1 );      % Create the global reaction vector
  u        = sparse( nndof , 1 );      % Nodal variables
  
% Material properties (constant over the domain)
  D_matb = young*inertia;

  ttim = timing('Time needed to  set initial values',ttim); %Reporting time

% Element cycle
  for ielem = 1 : nelem
      
    lnods(1:nnode) = elements(ielem,1:nnode);
 
    coor_x(1:nnode) = coordinates(lnods(1:nnode),1);   % Elem. X coordinate

    len = coor_x(2) - coor_x(1);  % x_j > x_i
    
    const = D_matb/len^3;
    
    K_elem = [ 12    , 6*len  , -12    ,  6*len  ;
                6*len, 4*len^2,  -6*len,  2*len^2;
              -12    ,-6*len  ,  12    , -6*len  ;
                6*len, 2*len^2,  -6*len,  4*len^2];
            
    K_elem = K_elem * const;
        
    f       = (-denss*area + uniload(ielem))*len/2;
    ElemFor = [ f, f*len/6, f,-f*len/6];

% Find the equation number list for the i-th element
    for i = 1 : nnode
      ii = (i-1)*dofpn;
      for j = 1 : dofpn
        eqnum(ii+j) = (lnods(i)-1)*dofpn + j;   % Build the eq. number list
      end
    end

% Assemble the force vector and the stiffness matrix
    for i = 1 : dofpe
      ipos = eqnum(i);
      force (ipos) = force(ipos) + ElemFor(i);
      for j = 1 : dofpe
         jpos = eqnum(j);
         StifMat (ipos,jpos) = StifMat (ipos,jpos) + K_elem(i,j);
      end
    end

  end  % End element cycle
  
  ttim = timing('Time to assemble the global system',ttim); %Reporting time

% Add point load conditions to the force vector
  for i = 1 : size(pointload,1)
    ieqn = (pointload(i,1)-1)*dofpn + pointload(i,2);   % Find eq. number
    force(ieqn) = force(ieqn) + pointload(i,3);         % and add the force
  end

  ttim = timing('Time for apply side and point load',ttim); %Reporting time

% Apply the Dirichlet conditions and adjust the right hand side
  for i = 1 : size(fixnodes,1)
    ieqn = (fixnodes(i,1)-1)*dofpn + fixnodes(i,2);  % Find equation number
    u(ieqn) = fixnodes(i,3);                  % and store the solution in u
    fix(i) = ieqn;                        % and mark the eq. as a fix value
  end
  
  force1 = force - StifMat * u;      % Adjust the rhs with the known values

% Compute the solution by solving StifMat * u = force for the remaining
% unknown values of u
  FreeNodes = setdiff( 1:nndof , fix );           % Find the free node list
                                                  % and solve for it
  u(FreeNodes) = StifMat(FreeNodes,FreeNodes) \ force1(FreeNodes);

  ttim = timing('Time to solve the stiffness matrix',ttim); %Reporting time

% Compute the reactions on the fixed nodes as R = StifMat * u - F
  reaction(fix) = StifMat(fix,1:nndof) * u(1:nndof) - force(fix);

  ttim = timing('Time to solve the  nodal reactions',ttim); %Reporting time

% Compute the stresses
  Strnod = Stress_Beam_EulerBernoulliDD_v1_3(D_matb,u);

  ttim = timing('Time to  solve the  nodal stresses',ttim); %Reporting time
  
% Graphic representation
  ToGiD_Beam_EulerBernoulliDD_v1_3(file_name,u,reaction,Strnod); 

  ttim = timing('Time  used to write  the  solution',ttim); %Reporting time
  itim = toc;                                               %Close last tic
  fprintf(1,'\nTotal running time %12.6f \n\n',ttim); %Reporting final time

 
