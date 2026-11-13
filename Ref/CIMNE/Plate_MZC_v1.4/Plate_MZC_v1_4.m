%% MAT-fem_Plates
% 4 Nodes Quadrilateral Thin Plate Element MZC

% Clear memory and variables
  clear
  
% The variables are read as a MAT-fem subroutine
% young = Young Modulus
% poiss = Poission Ratio
% thick = Thickness 
% denss = Density
% coordinates = [ x , y ] coordinate matrix nnode x ndime (2) 
% elements    = [ inode , jnode , knode , lnode ] element connectivity
%               matrix. Matrix size: nelem x nnode; nnode = 4
% fixnodes    = [ node number , dof , fixed value ] matrix with Dirichlet
%               restrictions, were dof=1 for vertical displacement,
%               dof=2 for rotation in x and dof=3 for rotation in y
% pointload   = [ node number , dof , load value ] matrix with
%               nodal loads, were dof=1 for vertical load,
%               dof=2 for x moment and dof=3 for y moment
% uniload     = [ uniform vertical load ] sparse matrix size: nelem x 1

  file_name = input('Enter the file name: ','s');

  tic;                   % Start clock
  ttim = 0;              % Initialize time counter
  eval(file_name);       % Read input file

% Find basic dimensions
  npnod = size(coordinates,1);         % Number of nodes
  nelem = size(elements,1);            % Number of elements
  nnode = size(elements,2);            % Number of nodes per element
  nndof = npnod*3;                     % Number of total DOF 
  dofpn = 3;                           % Number of DOF per node
  dofpe = nnode*dofpn;                 % Number of DOF per element
  nndof = npnod*dofpn;                 % Number of total DOF 

  elements = sortrows(elements);

  ttim = timing('Time needed to read the input file',ttim); %Reporting time

% Dimension the global matrices
  StifMat  = sparse( nndof , nndof );  % Create the global stiffness matrix
  force    = sparse( nndof , 1 );      % Create the global force vector
  force1   = sparse( nndof , 1 );      % Create the global force vector
  reaction = sparse( nndof , 1 );      % Create the global reaction vector
  u        = sparse( nndof , 1 );      % Nodal variables

% Material properties (Constant over the domain)
  aux0 = young*thick^3/(12*(1-poiss^2));
  
  D_mat = [       aux0, poiss*aux0,                0 ;
            poiss*aux0,       aux0,                0 ;
                     0,          0, aux0*(1-poiss)/2];

  ttim = timing('Time needed to  set initial values',ttim); %Reporting time

% Gauss point coordinates
  gauss_x(1) = -1/sqrt(3);
  gauss_y(1) = -1/sqrt(3);

  gauss_x(2) =  1/sqrt(3);
  gauss_y(2) =-1/sqrt(3);

  gauss_x(3) = 1/sqrt(3);
  gauss_y(3) = 1/sqrt(3);

  gauss_x(4) =-1/sqrt(3);
  gauss_y(4) = 1/sqrt(3);
  
% Element cycle
  for ielem = 1 : nelem
      
    lnods(1:nnode) = elements(ielem,1:nnode);
  
    coor_x(1:nnode) = coordinates(lnods(1:nnode),1);  % Elem. X coordinates
    coor_y(1:nnode) = coordinates(lnods(1:nnode),2);  % Elem. Y coordinates

    a  = (coor_x(2) - coor_x(1))/2;
    a2 = (coor_x(3) - coor_x(4))/2;
    b  = (coor_y(4) - coor_y(1))/2;
    b2 = (coor_y(3) - coor_y(2))/2;
    
    if ((a ~= a2) || (b ~= b2))
      fprintf(1,'\n WARNING Only rectangular elements allowed \n');
    end
    if (a == 0)
      a = (coor_x(3) - coor_x(2))/2;
      b = (coor_y(1) - coor_y(2))/2;
      lnods(1) = elements(ielem,2);
      lnods(2) = elements(ielem,3);
      lnods(3) = elements(ielem,4);
      lnods(4) = elements(ielem,1);
    end
    if (a < 0)                            % Adjust the nodal connectivities
      a = abs(a);
      b = abs(b);
      lnods(1) = elements(ielem,3);
      lnods(2) = elements(ielem,4);
      lnods(3) = elements(ielem,1);
      lnods(4) = elements(ielem,2);
    end

    K_elem = zeros( dofpe , dofpe );

    for igaus = 1 : 4
      x = gauss_x(igaus);
      y = gauss_y(igaus);

      bmat_b = B_mat_Plate_MZC_v1_4(a,b,x,y); 

      K_elem = K_elem + transpose(bmat_b)*D_mat*bmat_b*a*b;
      
    end
    
    f       = 4*(-denss*thick + uniload(ielem))*a*b;
    ElemFor = f*[1/4, a/12, b/12,1/4,-a/12, b/12,...
                 1/4,-a/12,-b/12,1/4, a/12,-b/12];

% Find the equation number list for the i-th element
    for i = 1 : nnode
      ii = (i-1)*dofpn;
      for j = 1 : dofpn;
        eqnum(ii+j) = (lnods(i)-1)*dofpn + j ;  % Build the eq. number list
      end
    end

% Assemble the force vector and the stiffnes matrix
    for i = 1 : dofpe
      ipos = eqnum(i);
      force(ipos,1) = force(ipos,1) + ElemFor(i);
      for j = 1 : dofpe
        jpos = eqnum(j);
        StifMat(ipos,jpos) = StifMat(ipos,jpos) + K_elem(i,j);
      end
    end

  end  % End element cycle
  
  ttim = timing('Time to assemble the global system',ttim); %Reporting time

% Add point load conditions to the force vector
  for i = 1 : size(pointload,1)
    ieqn = (pointload(i,1)-1)*dofpn + pointload(i,2);   % Find eq. number
    force(ieqn,1) = force(ieqn,1) + pointload(i,3);     % and add the force
  end

  ttim = timing('Time for apply side and point load',ttim); %Reporting time

% Apply the Dirichlet conditions and adjust the right hand side
  j = 0;
  for i = 1 : size(fixnodes,1)
    ieqn = (fixnodes(i,1)-1)*dofpn + fixnodes(i,2);  % Find equation number
    u(ieqn) = fixnodes(i,3);                  % and store the solution in u
    j = j + 1;
    fix(j) = ieqn;                        % and mark the eq. as a fix value
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
  Strnod = Stress_Plate_MZC_v1_4(D_mat,gauss_x,gauss_y,u);
  
  ttim = timing('Time to  solve the  nodal stresses',ttim); %Reporting time
  
% Graphic representation
  ToGiD_Plate_MZC_v1_4(file_name,u,reaction,Strnod); 

  ttim = timing('Time  used to write  the  solution',ttim); %Reporting time
  itim = toc;                                               %Close last tic
  fprintf(1,'\nTotal running time %12.6f \n\n',ttim); %Reporting final time
  
