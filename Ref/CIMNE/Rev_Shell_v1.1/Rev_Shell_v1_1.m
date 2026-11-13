%% MAT-fem_RevShells
% 2 Nodes Linear Thick Revolution Shell Element 

% Clear memory and variables
  clear
  
% The variables are readed as a MAT-fem subroutine
% young = Young Modulus
% poiss = Poission Ratio
% thick = Thickness 
% denss = Density
% coordinates = [ x , y ] coordinate matrix nnode x ndime (2)
% elements    = [ inode , jnode ] element connectivity matrix.
%               Matrix size: nelem x nnode; nnode = 2
% fixnodes    = [ node number , dimension , fixed value ] matrix with 
%               Dirichlet restrictions
% pointload   = [ node number , dimension , load value ] matrix with 
%               nodal loads
% uniload     = [ normal surface load ] sparse matrix size: nelem x 1

  file_name = input('Enter the file name: ','s');

  tic;                   % Start clock
  ttim = 0;              % Initialize time counter
  eval(file_name);       % Read input file

% Find basic dimensions
  npnod = size(coordinates,1);         % Number of nodes
  nelem = size(elements,1);            % Number of elements
  nnode = size(elements,2);            % Number of nodes per element
  nndof = npnod*3;                     % Number of total DOF 
  
  ttim = timing('Time needed to read the input file',ttim); %Reporting time

% Dimension the global matrices
  StifMat  = sparse( nndof , nndof );  % Create the global stiffness matrix
  force    = sparse( nndof , 1 );      % Create the global force vector
  force1   = sparse( nndof , 1 );      % Create the global force vector
  reaction = sparse( nndof , 1 );      % Create the global reaction vector
  u        = sparse( nndof , 1 );      % Nodal variables
  
% Material properties (Constant over the domain)
  aux1 = thick*young/(1-poiss^2);
  aux2 = poiss*aux1;
  aux3 = (5/6)*thick*young/2/(1+poiss);
   
  D_matm = [aux1,aux2;
            aux2,aux1];
 
  D_matb = D_matm*(thick^2/12);
            
  D_mats = aux3;


  ttim = timing('Time needed to  set initial values',ttim); %Reporting time
  
% Element cycle
  for ielem = 1 : nelem
      
    lnods(1:nnode) = elements(ielem,1:nnode);
  
    cxy(1:nnode,:) = coordinates(lnods(1:nnode),:);   % Element coordinates

    Te = Rotation_system_RS_v1_1(cxy);
    
    r = (cxy(1,1)+cxy(2,1))/2;                      % Radius of the element
    
    [bmat_b,bmat_s,bmat_m,len] = B_mat_Rev_Shell_v1_1(cxy,Te); 
 
    K_b = transpose(bmat_b)*D_matb*bmat_b*2*pi*r*len;
    K_s = transpose(bmat_s)*D_mats*bmat_s*2*pi*r*len;
    K_m = transpose(bmat_m)*D_matm*bmat_m*2*pi*r*len;

    K_elem = K_b + K_s + K_m ;

    c1 = 2*cxy(1,1)+   cxy(2,1);
    c2 =   cxy(1,1)+ 2*cxy(2,1);
    
    fx1 = uniload(ielem) * Te(2,1)*pi*len*c1/3;
    fx2 = uniload(ielem) * Te(2,1)*pi*len*c2/3;
    
    fy1 = (uniload(ielem) * Te(1,1) - denss*thick)*pi*len*c1/3;
    fy2 = (uniload(ielem) * Te(1,1) - denss*thick)*pi*len*c2/3;

    ElemFor = [fx1,fy1,0,fx2,fy2,0];

% Find the equation number list for the i-th element
    for i = 1 : 2
      ii = (i-1)*3;
      eqnum(ii+1) = (lnods(i)-1)*3 + 1;    % Build the equation number list
      eqnum(ii+2) = (lnods(i)-1)*3 + 2;
      eqnum(ii+3) = (lnods(i)-1)*3 + 3;
    end

% Assemble the force vector and the stiffnes matrix
    for i = 1 : 6
      ipos = eqnum(i);
      force(ipos,1) = force(ipos,1) + ElemFor(i);
      for j = 1 : 6
         jpos = eqnum(j);
         StifMat(ipos,jpos) = StifMat(ipos,jpos) + K_elem(i,j);
      end
    end

  end  % End element cycle
  
  ttim = timing('Time to assemble the global system',ttim); %Reporting time

% Add point load conditions to the force vector
  for i = 1 : size(pointload,1)
    ieqn = (pointload(i,1)-1)*3 + pointload(i,2);         % Find eq. number
    x = coordinates(pointload(i,1),1);
    force(ieqn,1) = force(ieqn,1) + pointload(i,3)*2*pi*x;  % Add the force
  end

  ttim = timing('Time for apply side and point load',ttim); %Reporting time

% Apply the Dirichlet conditions and adjust the right hand side
  j = 0;
  for i = 1 : size(fixnodes,1)
    ieqn = (fixnodes(i,1)-1)*3 + fixnodes(i,2);  % Find the equation number
    u(ieqn) = fixnodes(i,3);                  % and store the solution in u
    j = j + 1;
    fix(j) = ieqn;                        % and mark the eq. as a fix value
  end
  
  force1 = force - StifMat * u;      % Adjust the rhs with the known values

% Compute the solution by solving StifMat * u = force for the remaining
% unknown values of u.
  FreeNodes = setdiff ( 1:nndof , fix );          % Find the free node list
                                                  % and solve for it
  u(FreeNodes) = StifMat(FreeNodes,FreeNodes) \ force1(FreeNodes);

  ttim = timing('Time to solve the stiffness matrix',ttim); %Reporting time

% Compute the reactions on the fixed nodes as R = StifMat * u - F
  reaction(fix) = StifMat(fix,1:nndof) * u(1:nndof) - force(fix);

  ttim = timing('Time to solve the  nodal reactions',ttim); %Reporting time

% Compute the stresses
  Strnod = Stress_Rev_Shell_v1_1 (D_matb,D_mats,D_matm,u);
  
  ttim = timing('Time to  solve the  nodal stresses',ttim); %Reporting time
  
% Graphic representation
  ToGiD_Rev_Shell_v1_1(file_name,u,reaction,Strnod); 

  ttim = timing('Time  used to write  the  solution',ttim); %Reporting time
  itim = toc;                                               %Close last tic
  fprintf(1,'\nTotal running time %12.6f \n\n',ttim); %Reporting final time
  
